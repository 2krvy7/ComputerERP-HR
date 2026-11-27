
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import String, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.core.roles import (
    ADMIN_ROLE_ID,
    STAFF_ROLE_ID,
    SUPERADMIN_ROLE_ID,
)
from app.dependencies.auth import (
    get_current_user,
    require_admin,
    require_password_change_completed,
)
from app.models.customer import Customer
from app.models.delivery import Delivery
from app.models.item_master import ItemMaster
from app.models.sales_quotation import SalesQuotation
from app.models.sales_quotation_detail import SalesQuotationDetail
from app.models.sales_order import SalesOrder
from app.models.sales_order_detail import SalesOrderDetail
from app.models.stock import Stock
from app.models.user import User
from app.models.warehouse import Warehouse

from app.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderStatusUpdate,
)

router = APIRouter(
    prefix="/api/orders",
    tags=["Sales Orders"],
    dependencies=[Depends(require_password_change_completed)],
)


class SellingPriceUpdate(BaseModel):
    markup_percentage: Decimal = Field(ge=0)


FINISHED_GOODS_TYPES = {
    "finished",
    "finished goods",
}

FINISHED_GOODS_WAREHOUSES = {
    "warehouseafinishedgoods",
    "warehousebfinishedgoods",
}


def is_finished_good(item: ItemMaster) -> bool:
    return (
        (item.ItemType or "").strip().lower()
        in FINISHED_GOODS_TYPES
    )


def is_finished_goods_warehouse(name: str | None) -> bool:
    normalized = re.sub(
        r"[^a-z0-9]",
        "",
        (name or "").lower(),
    )

    return normalized in FINISHED_GOODS_WAREHOUSES


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


def get_reserved_quantity(detail: SalesOrderDetail) -> int:
    return sum(
        int(allocation.get("quantity", 0))
        for allocation in (detail.stock_allocations or [])
        if not allocation.get("released", False)
    )


def get_order_reservation_status(
    order: SalesOrder,
) -> tuple[bool, list[dict]]:
    shortages = []

    for detail in order.details:
        reserved = get_reserved_quantity(detail)
        requested = int(detail.quantity)

        if reserved < requested:
            shortages.append({
                "order_detail_id": detail.order_detail_id,
                "IM_ID": detail.IM_ID,
                "requested": requested,
                "reserved": reserved,
                "shortage": requested - reserved,
            })

    return len(shortages) == 0, shortages


def get_requested_quantities(order: SalesOrder) -> dict[int, int]:
    quantities = defaultdict(int)

    for detail in order.details:
        quantities[detail.IM_ID] += detail.quantity

    return dict(quantities)


def reserve_missing_stock(
    db: Session,
    details: list[SalesOrderDetail],
) -> None:
    """
    Reserve any unreserved quantities from available Finished Goods
    stock. Existing reservations are preserved.
    """

    item_ids = {
        detail.IM_ID
        for detail in details
    }

    if not item_ids:
        return

    stock_rows = db.scalars(
        select(Stock)
        .join(
            Warehouse,
            Warehouse.WH_ID == Stock.WH_ID,
        )
        .where(
            Stock.IM_ID.in_(item_ids),
        )
        .order_by(
            Stock.IM_ID,
            Stock.WH_ID,
            Stock.STOCK_ID,
        )
        .with_for_update()
    ).all()

    eligible_stock = [
        stock
        for stock in stock_rows
        if is_finished_goods_warehouse(
            db.get(Warehouse, stock.WH_ID).Warehouse_Name
            if db.get(Warehouse, stock.WH_ID)
            else None
        )
    ]

    stock_by_item = defaultdict(list)

    for stock in eligible_stock:
        stock_by_item[stock.IM_ID].append(stock)

    available_by_stock = {
        stock.STOCK_ID: max(
            0,
            int(stock.quantity_on_hand or 0)
            - int(stock.quantity_reserved or 0),
        )
        for stock in eligible_stock
    }

    for detail in details:
        existing_allocations = list(
            detail.stock_allocations or []
        )

        already_reserved = sum(
            int(allocation.get("quantity", 0))
            for allocation in existing_allocations
            if not allocation.get("released", False)
        )

        remaining = max(
            0,
            int(detail.quantity) - already_reserved,
        )

        if remaining == 0:
            continue

        for stock in stock_by_item.get(detail.IM_ID, []):
            available = available_by_stock[stock.STOCK_ID]

            if available <= 0:
                continue

            reserve_quantity = min(remaining, available)

            stock.quantity_reserved = (
                int(stock.quantity_reserved or 0)
                + reserve_quantity
            )

            available_by_stock[stock.STOCK_ID] -= reserve_quantity
            remaining -= reserve_quantity

            existing_allocations.append({
                "stock_id": stock.STOCK_ID,
                "warehouse_id": stock.WH_ID,
                "quantity": reserve_quantity,
            })

            if remaining == 0:
                break

        detail.stock_allocations = existing_allocations


def release_order_reservations(
    db: Session,
    details: list[SalesOrderDetail],
) -> None:
    """
    Return all unreleased reservations to available stock.
    """

    stock_ids = {
        int(allocation["stock_id"])
        for detail in details
        for allocation in (detail.stock_allocations or [])
        if not allocation.get("released", False)
    }

    if not stock_ids:
        return

    stock_rows = db.scalars(
        select(Stock)
        .where(Stock.STOCK_ID.in_(stock_ids))
        .order_by(Stock.STOCK_ID)
        .with_for_update()
    ).all()

    stocks_by_id = {
        stock.STOCK_ID: stock
        for stock in stock_rows
    }

    for detail in details:
        allocations = list(detail.stock_allocations or [])
        updated_allocations = []

        for allocation in allocations:
            if allocation.get("released", False):
                updated_allocations.append(allocation)
                continue

            stock_id = int(allocation["stock_id"])
            quantity = int(allocation["quantity"])
            stock = stocks_by_id.get(stock_id)

            if stock is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "A reserved stock record could not be found. "
                        "The reservation cannot be safely released."
                    ),
                )

            if int(stock.quantity_reserved or 0) < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "The reserved stock quantity does not match "
                        "the stock record. Please check the reservation."
                    ),
                )

            stock.quantity_reserved = (
                int(stock.quantity_reserved or 0) - quantity
            )

        detail.stock_allocations = updated_allocations


def load_order(
    db: Session,
    order_id: int,
):
    return db.scalar(
        select(SalesOrder)
        .options(selectinload(SalesOrder.details))
        .where(SalesOrder.order_id == order_id)
    )


def is_inventory_user(current_user: User) -> bool:
    return (
        current_user.dept_id == "IN"
        and current_user.role_id in (
            STAFF_ROLE_ID,
            ADMIN_ROLE_ID,
        )
    )


def is_sales_user(current_user: User) -> bool:
    return (
        current_user.dept_id == "SL"
        and current_user.role_id in (
            STAFF_ROLE_ID,
            ADMIN_ROLE_ID,
        )
    )


def is_superadmin(current_user: User) -> bool:
    return current_user.role_id == SUPERADMIN_ROLE_ID



@router.get("/items")
def get_order_items(
    search: str | None = Query(default=None, max_length=150),
    db: Session = Depends(get_db),
):
    stock_totals = (
        select(
            Stock.IM_ID.label("IM_ID"),
            func.coalesce(
                func.sum(
                    func.greatest(
                        Stock.quantity_on_hand
                        - Stock.quantity_reserved,
                        0,
                    )
                ),
                0,
            ).label("stock_available"),
        )
        .join(
            Warehouse,
            Warehouse.WH_ID == Stock.WH_ID,
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
            ),
            func.lower(
                func.trim(
                    func.cast(ItemMaster.status, String)
                )
            ).in_(["active", "true"]),
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(
            ItemMaster.Item_Name.ilike(term)
            | ItemMaster.SKU.ilike(term)
        )

    statement = statement.order_by(ItemMaster.IM_ID.desc())
    results = db.execute(statement).all()

    return [
        {
            "IM_ID": item.IM_ID,
            "SKU": item.SKU,
            "Item_Name": item.Item_Name,
            "Category": item.Category,
            "Brand": item.Brand,
            "ItemType": item.ItemType,
            "unit_of_measure": item.unit_of_measure,
            "Price": item.Price,
            "status": item.status,
            "stock_available": int(stock_available or 0),
        }
        for item, stock_available in results
    ]



@router.get(
    "/finished-goods",
    dependencies=[Depends(require_admin)],
)
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

    items = db.scalars(
        statement.order_by(ItemMaster.IM_ID.desc())
    ).all()

    return [
        get_item_pricing_data(item)
        for item in items
    ]


@router.patch(
    "/items/{item_id}/selling-price",
    dependencies=[Depends(require_admin)],
)
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
            detail="Selling prices can only be updated for Finished Goods.",
        )

    if item.production_cost is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Production cost has not been provided by Finance.",
        )

    production_cost = Decimal(str(item.production_cost))
    markup_percentage = Decimal(str(price_data.markup_percentage))

    if production_cost < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Production cost cannot be negative.",
        )

    selling_price = (
        production_cost
        * (Decimal("1") + markup_percentage / Decimal("100"))
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
    current_user: User = Depends(get_current_user),
):
    if not is_superadmin(current_user) and not is_sales_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Sales staff or admins can submit Sales order requests.",
        )

    customer = db.get(Customer, order_data.customer_id)

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
        quotation = db.get(SalesQuotation, order_data.quotation_id)

        if quotation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quotation not found.",
            )

        if quotation.customer_id != order_data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quotation does not belong to this customer.",
            )

        if quotation.status != "Accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only accepted quotations can be converted to orders.",
            )

        existing_order = db.scalar(
            select(SalesOrder).where(
                SalesOrder.quotation_id == order_data.quotation_id
            )
        )

        if existing_order is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This quotation has already been converted to an order.",
            )

    if not order_data.details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add at least one item to the sales order.",
        )

    requested_quantities = defaultdict(int)

    for detail in order_data.details:
        if detail.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item quantities must be greater than zero.",
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

    order_details = []
    order_total = Decimal("0")

    for detail in order_data.details:
        item = items_by_id[detail.IM_ID]

        if item.Price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item {item.Item_Name} has no available price.",
            )

        unit_price = Decimal(str(item.Price))
        discount = Decimal(str(detail.discount))

        if discount < 0 or discount > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount must be between 0 and 100.",
            )

        gross_total = Decimal(detail.quantity) * unit_price
        discount_amount = gross_total * discount / Decimal("100")
        line_total = gross_total - discount_amount
        order_total += line_total

        order_details.append({
            "IM_ID": item.IM_ID,
            "quantity": detail.quantity,
            "unit_price": unit_price,
            "discount": discount,
            "line_total": line_total,
        })

    tax_type = (
        quotation.tax_type
        if quotation is not None
        else order_data.tax_type
    )

    tax_rate = Decimal(str(
        quotation.tax_rate
        if quotation is not None
        else order_data.tax_rate or "0.00"
    ))

    installment_months = (
        quotation.installment_months
        if quotation is not None
        else order_data.installment_months
    )

    tax_amount = (
        order_total * tax_rate / Decimal("100")
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    interest_rate = {
        1: Decimal("0.00"),
        3: Decimal("3.00"),
        6: Decimal("5.00"),
        12: Decimal("10.00"),
    }[installment_months]

    interest_amount = (
        order_total * interest_rate / Decimal("100")
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    quotation_total = order_total + tax_amount + interest_amount

    try:
        if quotation is None:
            quotation = SalesQuotation(
                customer_id=order_data.customer_id,
                quotation_date=order_data.order_date or date.today(),
                status="Draft",
                total_amount=quotation_total,
                tax_type=tax_type,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                installment_months=installment_months,
                interest_rate=interest_rate,
                interest_amount=interest_amount,
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
            order_date=order_data.order_date or date.today(),
            status="Pending",
            total_amount=order_total,
            tax_type=tax_type,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            installment_months=installment_months,
        )

        db.add(order)
        db.flush()

        created_details = []

        for detail in order_details:
            order_detail = SalesOrderDetail(
                order_id=order.order_id,
                **detail,
            )
            db.add(order_detail)
            created_details.append(order_detail)

        db.flush()

        reserve_missing_stock(db, created_details)

        db.commit()
        return load_order(db, order.order_id)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to create the sales order and its related quotation. "
                "A duplicate or database constraint conflict may exist."
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
    order = load_order(db, order_id)

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
    current_user: User = Depends(get_current_user),
):
    try:
        order = db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(SalesOrder.order_id == order_id)
            .with_for_update()
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sales order not found.",
            )

        if not is_superadmin(current_user) and not is_inventory_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Inventory staff or admins can update Sales order processing statuses.",
            )

        requested_status = status_data.status
        current_status = order.status

        if requested_status == "Accepted":
            if current_status != "Pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only Pending Sales Orders can be accepted by Inventory.",
                )

            if not order.details:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This order has no items and cannot be accepted.",
                )

            reserve_missing_stock(db, order.details)
            fully_reserved, _ = get_order_reservation_status(order)

            order.status = (
                "Preparing"
                if fully_reserved
                else "Waiting for Stock"
            )

            db.commit()
            return load_order(db, order_id)

        if requested_status == "Preparing":
            if current_status != "Waiting for Stock":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only orders Waiting for Stock can be moved to Preparing.",
                )

            reserve_missing_stock(db, order.details)
            fully_reserved, shortages = get_order_reservation_status(order)

            if not fully_reserved:
                db.commit()

                shortage_details = "; ".join(
                    (
                        f"Item {entry['IM_ID']}: "
                        f"{entry['reserved']}/{entry['requested']} reserved; "
                        f"{entry['shortage']} still needed"
                    )
                    for entry in shortages
                )

                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "The order is still waiting for stock. "
                        f"{shortage_details}"
                    ),
                )

            order.status = "Preparing"
            db.commit()
            return load_order(db, order_id)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This Sales Order status transition is not allowed here.",
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_superadmin(current_user) and not is_sales_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Sales staff or admins can cancel a Sales Order.",
        )

    try:
        order = db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(SalesOrder.order_id == order_id)
            .with_for_update()
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sales order not found.",
            )

        if order.status in ("Completed", "Released to Sales", "Cancelled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Sales Order can no longer be cancelled.",
            )

        existing_delivery = db.scalar(
            select(Delivery.delivery_id).where(
                Delivery.order_id == order_id
            )
        )

        if existing_delivery is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This order already has a delivery record. "
                    "Cancel or resolve the delivery before cancelling the order."
                ),
            )

        release_order_reservations(db, order.details)
        order.status = "Cancelled"

        db.commit()

        return {
            "message": "Sales Order cancelled and reserved stock released.",
            "order_id": order_id,
            "status": order.status,
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise
