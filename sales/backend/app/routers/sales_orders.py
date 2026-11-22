from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.item_master import ItemMaster
from app.models.sales_quotation import SalesQuotation
from app.models.sales_quotation_detail import SalesQuotationDetail
from app.models.sales_order import SalesOrder
from app.models.sales_order_detail import SalesOrderDetail
from app.models.stock import Stock

from app.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderStatusUpdate,
)

router = APIRouter(
    prefix="/api/orders",
    tags=["Sales Orders"],
)


class SellingPriceUpdate(BaseModel):
    markup_percentage: Decimal = Field(ge=0)


FINISHED_GOODS_TYPES = {
    "finished",
    "finished goods",
}


def is_finished_good(item: ItemMaster) -> bool:
    return (
        (item.ItemType or "").strip().lower()
        in FINISHED_GOODS_TYPES
    )


def get_item_pricing_data(item: ItemMaster):
    return {
        "IM_ID": item.IM_ID,
        "SKU": item.SKU,
        "Item_Name": item.Item_Name,
        "Category": item.Category,
        "Brand": item.Brand,
        "ItemType": item.ItemType,
        "unit_of_measure": item.unit_of_measure,
        "production_cost": item.production_cost,
        "markup_percentage": item.markup_percentage,
        "Price": item.Price,
        "status": item.status,
    }


def deduct_order_stock(
    db: Session,
    order: SalesOrder,
):
    requested_item_ids = {
        detail.IM_ID
        for detail in order.details
    }

    stock_rows = db.scalars(
        select(Stock)
        .where(Stock.IM_ID.in_(requested_item_ids))
        .order_by(Stock.STOCK_ID)
        .with_for_update()
    ).all()

    stock_by_item = defaultdict(list)
    remaining_stock = {}

    for stock in stock_rows:
        stock_by_item[stock.IM_ID].append(stock)
        remaining_stock[stock.STOCK_ID] = int(
            stock.quantity_on_hand
        )

    allocation_plans = {}

    for detail in order.details:
        if detail.stock_allocations:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Stock has already been allocated for "
                    f"order detail {detail.order_detail_id}."
                ),
            )

        remaining_quantity = detail.quantity
        allocations = []

        for stock in stock_by_item.get(detail.IM_ID, []):
            available_quantity = remaining_stock[
                stock.STOCK_ID
            ]

            if available_quantity <= 0:
                continue

            deducted_quantity = min(
                remaining_quantity,
                available_quantity,
            )

            allocations.append({
                "stock_id": stock.STOCK_ID,
                "quantity": deducted_quantity,
            })

            remaining_stock[stock.STOCK_ID] -= (
                deducted_quantity
            )

            remaining_quantity -= deducted_quantity

            if remaining_quantity == 0:
                break

        if remaining_quantity > 0:
            item = db.get(ItemMaster, detail.IM_ID)

            item_name = (
                item.Item_Name
                if item
                else f"Item #{detail.IM_ID}"
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for {item_name}. "
                    f"Missing quantity: {remaining_quantity}."
                ),
            )

        allocation_plans[detail.order_detail_id] = allocations

    for stock in stock_rows:
        stock.quantity_on_hand = remaining_stock[
            stock.STOCK_ID
        ]

    for detail in order.details:
        detail.stock_allocations = allocation_plans[
            detail.order_detail_id
        ]


def restore_order_stock(
    db: Session,
    order: SalesOrder,
):
    stock_ids = set()

    for detail in order.details:
        if not detail.stock_allocations:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Stock allocation records are missing for "
                    f"order detail {detail.order_detail_id}. "
                    "Automatic restoration is not safe."
                ),
            )

        for allocation in detail.stock_allocations:
            stock_ids.add(allocation["stock_id"])

    stock_rows = db.scalars(
        select(Stock)
        .where(Stock.STOCK_ID.in_(stock_ids))
        .order_by(Stock.STOCK_ID)
        .with_for_update()
    ).all()

    stock_by_id = {
        stock.STOCK_ID: stock
        for stock in stock_rows
    }

    for detail in order.details:
        for allocation in detail.stock_allocations:
            stock_id = allocation["stock_id"]
            quantity = allocation["quantity"]

            stock = stock_by_id.get(stock_id)

            if stock is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Stock record {stock_id} no longer exists. "
                        "Automatic restoration cannot continue."
                    ),
                )

            stock.quantity_on_hand += quantity

    for detail in order.details:
        detail.stock_allocations = None


@router.get("/items")
def get_order_items(
    search: str | None = Query(default=None, max_length=150),
    db: Session = Depends(get_db),
):
    stock_totals = (
        select(
            Stock.IM_ID.label("IM_ID"),
            func.coalesce(
                func.sum(Stock.quantity_on_hand),
                0,
            ).label("stock_available"),
        )
        .group_by(Stock.IM_ID)
        .subquery()
    )

    statement = (
        select(
            ItemMaster,
            func.coalesce(
                stock_totals.c.stock_available,
                0,
            ).label("stock_available"),
        )
        .outerjoin(
            stock_totals,
            stock_totals.c.IM_ID == ItemMaster.IM_ID,
        )
        .where(
            func.lower(func.trim(ItemMaster.ItemType)).in_(
                list(FINISHED_GOODS_TYPES)
            )
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"

        statement = statement.where(
            ItemMaster.Item_Name.ilike(term)
            | ItemMaster.SKU.ilike(term)
        )

    statement = statement.order_by(
        ItemMaster.IM_ID.desc()
    )

    results = db.execute(statement).all()

    return [
        {
            "IM_ID": item.IM_ID,
            "SKU": item.SKU,
            "Item_Name": item.Item_Name,
            "Category": item.Category,
            "Brand": item.Brand,
            "unit_of_measure": item.unit_of_measure,
            "Price": item.Price,
            "status": item.status,
            "stock_available": int(stock_available or 0),
        }
        for item, stock_available in results
    ]


@router.get("/finished-goods")
def get_finished_goods(
    search: str | None = Query(default=None, max_length=150),
    db: Session = Depends(get_db),
):
    statement = select(ItemMaster).where(
        func.lower(func.trim(ItemMaster.ItemType)).in_(
            list(FINISHED_GOODS_TYPES)
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"

        statement = statement.where(
            ItemMaster.Item_Name.ilike(term)
            | ItemMaster.SKU.ilike(term)
        )

    statement = statement.order_by(
        ItemMaster.IM_ID.desc()
    )

    items = db.scalars(statement).all()

    return [
        get_item_pricing_data(item)
        for item in items
    ]


@router.patch("/items/{item_id}/selling-price")
def update_selling_price(
    item_id: int,
    price_data: SellingPriceUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(ItemMaster, item_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if not is_finished_good(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Selling prices can only be updated "
                "for Finished Goods."
            ),
        )

    if item.production_cost is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Production cost has not been provided by Finance."
            ),
        )

    production_cost = Decimal(str(item.production_cost))
    markup_percentage = Decimal(
        str(price_data.markup_percentage)
    )

    if production_cost < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Production cost cannot be negative.",
        )

    selling_price = (
        production_cost
        * (
            Decimal("1")
            + markup_percentage / Decimal("100")
        )
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    try:
        item.markup_percentage = markup_percentage
        item.Price = selling_price

        db.commit()
        db.refresh(item)

        return get_item_pricing_data(item)

    except Exception:
        db.rollback()
        raise


@router.get(
    "",
    response_model=list[SalesOrderResponse],
)
def get_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    statement = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.details))
        .order_by(SalesOrder.order_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    return db.scalars(statement).all()


@router.post(
    "",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    order_data: SalesOrderCreate,
    db: Session = Depends(get_db),
):
    customer = db.get(
        Customer,
        order_data.customer_id,
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    if not customer.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This customer is inactive.",
        )

    quotation = None

    if order_data.quotation_id is not None:
        quotation = db.get(
            SalesQuotation,
            order_data.quotation_id,
        )

        if quotation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quotation not found.",
            )

        if quotation.customer_id != order_data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Quotation does not belong to this customer."
                ),
            )

        if quotation.status != "Accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Only accepted quotations can be "
                    "converted to orders."
                ),
            )

        existing_order = db.scalar(
            select(SalesOrder).where(
                SalesOrder.quotation_id
                == order_data.quotation_id
            )
        )

        if existing_order is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This quotation has already been "
                    "converted to an order."
                ),
            )

    if not order_data.details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Please add at least one item to the sales order."
            ),
        )

    requested_quantities = defaultdict(int)

    for detail in order_data.details:
        if detail.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Item quantities must be greater than zero."
                ),
            )

        requested_quantities[detail.IM_ID] += detail.quantity

    items = db.scalars(
        select(ItemMaster).where(
            ItemMaster.IM_ID.in_(requested_quantities.keys())
        )
    ).all()

    items_by_id = {
        item.IM_ID: item
        for item in items
    }

    for item_id in requested_quantities:
        item = items_by_id.get(item_id)

        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} was not found.",
            )

        if not is_finished_good(item):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{item.Item_Name} is not a Finished Good. "
                    "Only Finished Goods can be added to Sales Orders."
                ),
            )

    stock_rows = db.execute(
        select(
            Stock.IM_ID,
            func.sum(
                Stock.quantity_on_hand
            ).label("stock_available"),
        )
        .where(
            Stock.IM_ID.in_(requested_quantities.keys())
        )
        .group_by(Stock.IM_ID)
    ).all()

    stock_by_item = {
        item_id: int(stock_available or 0)
        for item_id, stock_available in stock_rows
    }

    stock_errors = []

    for item_id, requested_quantity in requested_quantities.items():
        available_quantity = stock_by_item.get(
            item_id,
            0,
        )

        if requested_quantity > available_quantity:
            item = items_by_id[item_id]

            stock_errors.append(
                f"{item.Item_Name}: requested {requested_quantity}, "
                f"but only {available_quantity} available."
            )

    if stock_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Insufficient stock. "
                + " ".join(stock_errors)
            ),
        )

    order_details = []
    order_total = Decimal("0")

    for detail in order_data.details:
        item = items_by_id[detail.IM_ID]

        if item.Price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Item {item.Item_Name} "
                    "has no available price."
                ),
            )

        unit_price = Decimal(str(item.Price))
        discount = Decimal(str(detail.discount))

        if discount < 0 or discount > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount must be between 0 and 100.",
            )

        gross_total = (
            Decimal(detail.quantity) * unit_price
        )

        discount_amount = (
            gross_total * discount / Decimal("100")
        )

        line_total = gross_total - discount_amount

        order_total += line_total

        order_details.append({
            "IM_ID": item.IM_ID,
            "quantity": detail.quantity,
            "unit_price": unit_price,
            "discount": discount,
            "line_total": line_total,
        })

    try:
        if quotation is None:
            quotation = SalesQuotation(
                customer_id=order_data.customer_id,
                quotation_date=(
                    order_data.order_date or date.today()
                ),
                status="Accepted",
                total_amount=order_total,
            )

            db.add(quotation)
            db.flush()

            for detail in order_details:
                db.add(
                    SalesQuotationDetail(
                        quotation_id=quotation.quotation_id,
                        **detail,
                    )
                )

        order = SalesOrder(
            customer_id=order_data.customer_id,
            quotation_id=quotation.quotation_id,
            order_date=(
                order_data.order_date or date.today()
            ),
            status="Pending",
            total_amount=order_total,
        )

        db.add(order)
        db.flush()

        for detail in order_details:
            db.add(
                SalesOrderDetail(
                    order_id=order.order_id,
                    **detail,
                )
            )

        db.commit()

        return db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(
                SalesOrder.order_id == order.order_id
            )
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to create the sales order and its "
                "related quotation. A duplicate or database "
                "constraint conflict may exist."
            ),
        )

    except Exception:
        db.rollback()
        raise


@router.get(
    "/{order_id}",
    response_model=SalesOrderResponse,
)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(SalesOrder)
        .options(selectinload(SalesOrder.details))
        .where(
            SalesOrder.order_id == order_id
        )
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found.",
        )

    return order


@router.patch(
    "/{order_id}/status",
    response_model=SalesOrderResponse,
)
def update_order_status(
    order_id: int,
    status_data: SalesOrderStatusUpdate,
    db: Session = Depends(get_db),
):
    try:
        order = db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(
                SalesOrder.order_id == order_id
            )
            .with_for_update()
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sales order not found.",
            )

        current_status = order.status
        new_status = status_data.status

        if current_status == new_status:
            return order

        allowed_transitions = {
            "Pending": {
                "Approved",
                "Cancelled",
            },
            "Approved": {
                "Processing",
                "Cancelled",
            },
            "Processing": {
                "Completed",
                "Cancelled",
            },
            "Completed": set(),
            "Cancelled": {
                "Approved",
            },
        }

        if new_status not in allowed_transitions.get(
            current_status,
            set(),
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status transition: "
                    f"{current_status} to {new_status}."
                ),
            )

        if new_status == "Approved":
            deduct_order_stock(
                db,
                order,
            )

        elif new_status == "Cancelled":
            if current_status in (
                "Approved",
                "Processing",
            ):
                restore_order_stock(
                    db,
                    order,
                )

        order.status = new_status

        db.commit()

        return db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(
                SalesOrder.order_id == order_id
            )
        )

    except Exception:
        db.rollback()
        raise
