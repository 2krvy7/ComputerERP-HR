
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.item_master import ItemMaster
from app.models.sales_quotation import SalesQuotation
from app.models.sales_quotation_detail import SalesQuotationDetail
from app.models.sales_order import SalesOrder
from app.models.sales_order_detail import SalesOrderDetail

from app.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderStatusUpdate,
)

router = APIRouter(
    prefix="/api/orders",
    tags=["Sales Orders"],
)


# Retrieve products that can be added to an order.
@router.get("/items")
def get_order_items(
    search: str | None = Query(default=None, max_length=150),
    db: Session = Depends(get_db),
):
    statement = select(ItemMaster)

    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(
            ItemMaster.Item_Name.ilike(term)
            | ItemMaster.SKU.ilike(term)
        )

    statement = statement.order_by(ItemMaster.IM_ID.desc())

    items = db.scalars(statement).all()

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
        }
        for item in items
    ]


# Retrieve all sales orders.
@router.get("", response_model=list[SalesOrderResponse])
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


# Create a sales order and automatically generate
# its quotation when one is not already provided.
@router.post(
    "",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    order_data: SalesOrderCreate,
    db: Session = Depends(get_db),
):
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

    # Validate an existing quotation, if supplied.
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

    # Validate products and calculate order totals.
    order_details = []
    order_total = Decimal("0")

    for detail in order_data.details:
        item = db.get(ItemMaster, detail.IM_ID)

        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {detail.IM_ID} was not found.",
            )

        if item.Price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item {item.Item_Name} has no available price.",
            )

        unit_price = Decimal(str(item.Price))
        discount = Decimal(str(detail.discount))

        gross_total = Decimal(detail.quantity) * unit_price
        discount_amount = (
            gross_total * discount / Decimal("100")
        )
        line_total = gross_total - discount_amount

        order_total += line_total

        order_details.append(
            {
                "IM_ID": item.IM_ID,
                "quantity": detail.quantity,
                "unit_price": unit_price,
                "discount": discount,
                "line_total": line_total,
            }
        )

    try:
        # STEP 1: Automatically create a quotation
        # only if the order does not already have one.
        if quotation is None:
            quotation = SalesQuotation(
                customer_id=order_data.customer_id,
                quotation_date=order_data.order_date or date.today(),
                status="Accepted",
                total_amount=order_total,
            )

            db.add(quotation)
            db.flush()

            # Create quotation detail records.
            for detail in order_details:
                db.add(
                    SalesQuotationDetail(
                        quotation_id=quotation.quotation_id,
                        **detail,
                    )
                )

        # STEP 2: Create the sales order.
        order = SalesOrder(
            customer_id=order_data.customer_id,
            quotation_id=quotation.quotation_id,
            order_date=order_data.order_date or date.today(),
            status="Pending",
            total_amount=order_total,
        )

        db.add(order)
        db.flush()

        # STEP 3: Create sales order detail records.
        for detail in order_details:
            db.add(
                SalesOrderDetail(
                    order_id=order.order_id,
                    **detail,
                )
            )

        # STEP 4: Save the quotation and sales order.
        # Invoice and AR will be created separately
        # when the user adds a Sales Invoice.
        db.commit()

        # Return the newly created order with its details.
        return db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(SalesOrder.order_id == order.order_id)
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to create the sales order and its related "
                "quotation. A duplicate or database constraint "
                "conflict may exist."
            ),
        )

    except Exception:
        db.rollback()
        raise


# Retrieve one sales order.
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
        .where(SalesOrder.order_id == order_id)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found.",
        )

    return order


# Update sales order status.
@router.patch(
    "/{order_id}/status",
    response_model=SalesOrderResponse,
)
def update_order_status(
    order_id: int,
    status_data: SalesOrderStatusUpdate,
    db: Session = Depends(get_db),
):
    order = db.get(SalesOrder, order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found.",
        )

    order.status = status_data.status

    try:
        db.commit()

        return db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(SalesOrder.order_id == order_id)
        )

    except Exception:
        db.rollback()
        raise
