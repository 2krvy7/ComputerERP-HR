
from collections import defaultdict
from datetime import datetime
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.core.roles import (
    ADMIN_ROLE_ID,
    ADMIN_ROLE_IDS,
    STAFF_ROLE_ID,
    SUPERADMIN_ROLE_ID,
)
from app.dependencies.auth import (
    get_current_user,
    require_password_change_completed,
)
from app.models.user import User
from app.models.delivery import Delivery
from app.models.item_master import ItemMaster
from app.models.sales_order import SalesOrder
from app.models.stock import Stock
from app.models.stock_ledger import StockLedger
from app.models.warehouse import Warehouse
from app.schemas.delivery import (
    DeliveryCreate,
    DeliveryResponse,
    DeliveryStatusUpdate,
)

router = APIRouter(
    prefix="/api/deliveries",
    tags=["Deliveries"],
    dependencies=[Depends(require_password_change_completed)],
)

FINISHED_GOODS_TYPES = {
    "finished",
    "finished goods",
}

ALLOWED_TRANSITIONS = {
    "Pending": ["Preparing", "Cancelled"],
    "Preparing": ["Released", "Cancelled"],
    "Released": ["Delivered", "Cancelled"],
    "Delivered": [],
    "Cancelled": [],
}

INVENTORY_DEPT_ID = "IN"
SALES_DEPT_ID = "SL"


def normalize_status(value: str) -> str:
    if not isinstance(value, str):
        return value

    normalized = value.strip().lower()

    legacy_statuses = {
        "shipped": "Released",
        "released by inventory": "Released",
        "released to sales": "Released",
    }

    return legacy_statuses.get(normalized, value.strip())


def is_finished_goods_warehouse(name: str | None) -> bool:
    normalized = re.sub(
        r"[^a-z0-9]",
        "",
        (name or "").lower(),
    )

    is_finished_goods = (
        "finishedgood" in normalized
        or normalized.startswith("fg")
    )

    return is_finished_goods and normalized.endswith(("a", "b"))


def is_admin(user: User) -> bool:
    return user.role_id in ADMIN_ROLE_IDS


def require_sales_or_admin(user: User):
    if is_admin(user):
        return

    if user.dept_id != SALES_DEPT_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Sales or Admin can create delivery records.",
        )


def authorize_status_update(
    user: User,
    target_status: str,
):
    if user.role_id == SUPERADMIN_ROLE_ID:
        return

    if (
        user.role_id in (STAFF_ROLE_ID, ADMIN_ROLE_ID)
        and target_status in ("Preparing", "Released")
        and user.dept_id == INVENTORY_DEPT_ID
    ):
        return

    if (
        user.role_id in (STAFF_ROLE_ID, ADMIN_ROLE_ID)
        and target_status == "Delivered"
        and user.dept_id == SALES_DEPT_ID
    ):
        return

    if (
        user.role_id == ADMIN_ROLE_ID
        and user.dept_id == INVENTORY_DEPT_ID
        and target_status == "Cancelled"
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "You are not authorized to perform this delivery "
            "status update. Check your assigned department."
        ),
    )


def is_finished_good(item: ItemMaster) -> bool:
    return (
        (item.ItemType or "").strip().lower()
        in FINISHED_GOODS_TYPES
    )


def deduct_delivery_stock(
    db: Session,
    delivery: Delivery,
    order: SalesOrder,
    logged_by: str,
):
    reference_no = f"DEL-{delivery.delivery_id}"

    existing_ledger = db.scalar(
        select(StockLedger.LogID).where(
            StockLedger.ReferenceNo == reference_no,
            StockLedger.TransactionType == "STOCK_OUT",
        ).limit(1)
    )

    if existing_ledger is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stock has already been deducted for this delivery.",
        )

    if not order.details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This sales order has no item details.",
        )

    item_ids = {
        detail.IM_ID
        for detail in order.details
    }

    items = db.scalars(
        select(ItemMaster).where(
            ItemMaster.IM_ID.in_(item_ids)
        )
    ).all()

    items_by_id = {
        item.IM_ID: item
        for item in items
    }

    for detail in order.details:
        item = items_by_id.get(detail.IM_ID)

        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item {detail.IM_ID} not found.",
            )

        if not is_finished_good(item):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{item.Item_Name} is not a Finished Good. "
                    "Only Finished Goods can be released through Sales."
                ),
            )

        if detail.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid quantity for {item.Item_Name}.",
            )

        if detail.stock_allocations:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{item.Item_Name} already has stock allocations. "
                    "Check its previous stock deduction."
                ),
            )

    stock_rows = db.scalars(
        select(Stock)
        .where(
            Stock.IM_ID.in_(item_ids),
            Stock.WH_ID == delivery.WH_ID,
        )
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
    total_deducted_by_item = defaultdict(int)

    for detail in order.details:
        item = items_by_id[detail.IM_ID]
        remaining_quantity = int(detail.quantity)
        allocations = []

        for stock in stock_by_item.get(detail.IM_ID, []):
            available = remaining_stock[stock.STOCK_ID]

            if available <= 0:
                continue

            deducted = min(
                remaining_quantity,
                available,
            )

            allocations.append({
                "stock_id": stock.STOCK_ID,
                "warehouse_id": delivery.WH_ID,
                "quantity": deducted,
            })

            remaining_stock[stock.STOCK_ID] -= deducted
            remaining_quantity -= deducted
            total_deducted_by_item[detail.IM_ID] += deducted

            if remaining_quantity == 0:
                break

        if remaining_quantity > 0:
            available_quantity = (
                int(detail.quantity) - remaining_quantity
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient Finished Goods stock for "
                    f"{item.Item_Name} in the selected warehouse. "
                    f"Required: {detail.quantity}; "
                    f"Available: {available_quantity}; "
                    f"Missing: {remaining_quantity}."
                ),
            )

        allocation_plans[detail.order_detail_id] = allocations

    for stock in stock_rows:
        stock.quantity_on_hand = remaining_stock[stock.STOCK_ID]

    details_by_id = {
        detail.order_detail_id: detail
        for detail in order.details
    }

    for detail_id, allocations in allocation_plans.items():
        details_by_id[detail_id].stock_allocations = allocations

    for item_id, deducted_quantity in total_deducted_by_item.items():
        db.add(
            StockLedger(
                IM_ID=item_id,
                WH_ID=delivery.WH_ID,
                Target_WH_ID=None,
                TransactionType="STOCK_OUT",
                Quantity=deducted_quantity,
                ActualQuantity=deducted_quantity,
                ReferenceNo=reference_no,
                LoggedBy=logged_by,
                ApprovedBy=None,
                LogDate=datetime.now(),
                Remarks=(
                    f"Finished Goods released for "
                    f"Sales Order #{order.order_id}, "
                    f"Delivery #{delivery.delivery_id}."
                ),
            )
        )


# GET ALL DELIVERIES

@router.get(
    "",
    response_model=list[DeliveryResponse],
)
def get_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Delivery)
        .order_by(Delivery.delivery_id.desc())
    )

    return db.scalars(statement).all()


# GET FINISHED GOODS WAREHOUSES

@router.get("/warehouses")
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Warehouse)
        .order_by(Warehouse.Warehouse_Name)
    )

    warehouses = db.scalars(statement).all()

    return [
        {
            "WH_ID": warehouse.WH_ID,
            "Warehouse_Name": warehouse.Warehouse_Name,
            "Location": warehouse.Location,
        }
        for warehouse in warehouses
        if is_finished_goods_warehouse(
            warehouse.Warehouse_Name
        )
    ]


# GET DELIVERY BY ID

@router.get(
    "/{delivery_id}",
    response_model=DeliveryResponse,
)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delivery = db.get(Delivery, delivery_id)

    if delivery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery record not found.",
        )

    return delivery


# CREATE DELIVERY

@router.post(
    "",
    response_model=DeliveryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_delivery(
    delivery_data: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_sales_or_admin(current_user)

    order = db.get(
        SalesOrder,
        delivery_data.order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found.",
        )

    if order.status not in ("Accepted", "Approved"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only accepted sales orders can have a delivery record."
            ),
        )

    warehouse = db.get(
        Warehouse,
        delivery_data.WH_ID,
    )

    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Warehouse not found.",
        )

    if not is_finished_goods_warehouse(warehouse.Warehouse_Name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Deliveries must use Finished Goods Warehouse A or B."
            ),
        )

    existing_delivery = db.scalar(
        select(Delivery).where(
            Delivery.order_id == delivery_data.order_id
        )
    )

    if existing_delivery is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A delivery record already exists for this sales order."
            ),
        )

    delivery = Delivery(
        order_id=delivery_data.order_id,
        WH_ID=delivery_data.WH_ID,
        delivery_date=delivery_data.delivery_date,
        delivery_address=delivery_data.delivery_address,
        status="Pending",
    )

    try:
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        return delivery

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create the delivery record.",
        )

    except Exception:
        db.rollback()
        raise


# UPDATE DELIVERY STATUS

@router.patch(
    "/{delivery_id}/status",
    response_model=DeliveryResponse,
)
def update_delivery_status(
    delivery_id: int,
    status_data: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        delivery = db.scalar(
            select(Delivery)
            .where(
                Delivery.delivery_id == delivery_id
            )
            .with_for_update()
        )

        if delivery is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Delivery record not found.",
            )

        target_status = status_data.status
        current_status = normalize_status(delivery.status)

        authorize_status_update(
            current_user,
            target_status,
        )

        if current_status == target_status:
            return delivery

        allowed_statuses = ALLOWED_TRANSITIONS.get(
            current_status,
            [],
        )

        if target_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid delivery status transition: "
                    f"{current_status} to {target_status}."
                ),
            )

        if target_status == "Delivered":
            if (
                not status_data.received_by
                or not status_data.received_by.strip()
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Customer name is required to confirm "
                        "delivery acceptance."
                    ),
                )

        if target_status == "Released":
            if current_status != "Preparing":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Only deliveries with Preparing status "
                        "can be released by Inventory."
                    ),
                )

            order = db.scalar(
                select(SalesOrder)
                .options(
                    selectinload(SalesOrder.details)
                )
                .where(
                    SalesOrder.order_id == delivery.order_id
                )
                .with_for_update()
            )

            if order is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Related sales order not found.",
                )

            if order.status not in ("Accepted", "Approved"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "The related sales order must be Accepted "
                        "before Inventory can release the items."
                    ),
                )

            deduct_delivery_stock(
                db=db,
                delivery=delivery,
                order=order,
                logged_by=current_user.user_id,
            )

        delivery.status = target_status

        db.commit()
        db.refresh(delivery)

        return delivery

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The operation conflicts with an existing stock "
                "ledger entry. Check whether this delivery was "
                "already processed."
            ),
        )

    except Exception:
        db.rollback()
        raise
