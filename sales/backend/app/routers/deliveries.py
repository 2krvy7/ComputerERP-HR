
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

INVENTORY_DEPT_ID = "IN"
SALES_DEPT_ID = "SL"

PENDING_SALES = "pending-sales"
RELEASED_INVENTORY = "released-inventory"
DELIVERED_SALES = "delivered-sales"


def normalize_status(value: str) -> str:
    if not isinstance(value, str):
        return value

    normalized = value.strip().lower()

    legacy_statuses = {
        "pending": PENDING_SALES,
        "pending-sales": PENDING_SALES,
        "preparing": PENDING_SALES,
        "released": RELEASED_INVENTORY,
        "shipped": RELEASED_INVENTORY,
        "released by inventory": RELEASED_INVENTORY,
        "released to sales": RELEASED_INVENTORY,
        "released-inventory": RELEASED_INVENTORY,
        "delivered": DELIVERED_SALES,
        "delivered-sales": DELIVERED_SALES,
        "cancelled": PENDING_SALES,
        "canceled": PENDING_SALES,
    }

    return legacy_statuses.get(normalized, value.strip())


def is_finished_goods_warehouse(name: str | None) -> bool:
    normalized = re.sub(
        r"[^a-z0-9]",
        "",
        (name or "").lower(),
    )

    return normalized in {
        "warehouseafinishedgoods",
        "warehousebfinishedgoods",
    }


def is_admin(user: User) -> bool:
    return user.role_id in ADMIN_ROLE_IDS


def is_superadmin(user: User) -> bool:
    return user.role_id == SUPERADMIN_ROLE_ID


def is_inventory_user(user: User) -> bool:
    return (
        user.dept_id == INVENTORY_DEPT_ID
        and user.role_id in (
            STAFF_ROLE_ID,
            ADMIN_ROLE_ID,
        )
    )


def is_sales_user(user: User) -> bool:
    return (
        user.dept_id == SALES_DEPT_ID
        and user.role_id in (
            STAFF_ROLE_ID,
            ADMIN_ROLE_ID,
        )
    )


def require_sales_or_admin(user: User):
    if is_superadmin(user) or is_admin(user):
        return

    if not is_sales_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Sales staff or admins can create delivery records.",
        )


def authorize_status_update(
    user: User,
    target_status: str,
):
    if is_superadmin(user):
        return

    if (
        target_status == RELEASED_INVENTORY
        and is_inventory_user(user)
    ):
        return

    if (
        target_status == DELIVERED_SALES
        and is_sales_user(user)
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


def get_active_reservations(detail) -> list[dict]:
    return [
        allocation
        for allocation in (detail.stock_allocations or [])
        if not allocation.get("released", False)
    ]


def deduct_delivery_stock(
    db: Session,
    delivery: Delivery,
    order: SalesOrder,
    logged_by: str,
):
    """
    Deduct only the quantities reserved for this order.
    Reservations are deducted from their original stock rows,
    which may belong to more than one Finished Goods warehouse.
    """

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

    all_allocations = []
    stock_ids = set()
    total_deducted_by_item = defaultdict(int)
    deducted_by_item_and_warehouse = defaultdict(int)

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

        allocations = get_active_reservations(detail)

        reserved_quantity = sum(
            int(allocation.get("quantity", 0))
            for allocation in allocations
        )

        if reserved_quantity != int(detail.quantity):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{item.Item_Name} is not fully reserved. "
                    f"Required: {detail.quantity}; "
                    f"Reserved: {reserved_quantity}. "
                    "Inventory must reserve the remaining stock "
                    "before releasing the delivery."
                ),
            )

        for allocation in allocations:
            quantity = int(allocation.get("quantity", 0))
            stock_id = int(allocation.get("stock_id", 0))
            warehouse_id = int(allocation.get("warehouse_id", 0))

            if quantity <= 0 or stock_id <= 0 or warehouse_id <= 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Invalid stock reservation for {item.Item_Name}. "
                        "Please check the order's stock allocations."
                    ),
                )

            stock_ids.add(stock_id)

            all_allocations.append({
                "detail": detail,
                "item_id": detail.IM_ID,
                "stock_id": stock_id,
                "warehouse_id": warehouse_id,
                "quantity": quantity,
            })

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

    warehouse_ids = {
        allocation["warehouse_id"]
        for allocation in all_allocations
    }

    warehouses = db.scalars(
        select(Warehouse).where(
            Warehouse.WH_ID.in_(warehouse_ids)
        )
    ).all()

    warehouses_by_id = {
        warehouse.WH_ID: warehouse
        for warehouse in warehouses
    }

    for allocation in all_allocations:
        stock = stocks_by_id.get(allocation["stock_id"])
        warehouse = warehouses_by_id.get(allocation["warehouse_id"])

        if stock is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A reserved stock record no longer exists.",
            )

        if stock.IM_ID != allocation["item_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A stock reservation references the wrong item.",
            )

        if stock.WH_ID != allocation["warehouse_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A stock reservation references the wrong warehouse.",
            )

        if warehouse is None or not is_finished_goods_warehouse(
            warehouse.Warehouse_Name
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A reserved quantity is not in a Finished Goods warehouse.",
            )

        quantity = allocation["quantity"]

        if int(stock.quantity_reserved or 0) < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The reserved quantity does not match the stock record. "
                    "Please check the stock reservation before releasing."
                ),
            )

        if int(stock.quantity_on_hand or 0) < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Physical stock is lower than its reserved quantity. "
                    "Please investigate the stock record before releasing."
                ),
            )

    for allocation in all_allocations:
        stock = stocks_by_id[allocation["stock_id"]]
        quantity = allocation["quantity"]

        stock.quantity_on_hand = (
            int(stock.quantity_on_hand or 0) - quantity
        )

        stock.quantity_reserved = (
            int(stock.quantity_reserved or 0) - quantity
        )

        total_deducted_by_item[allocation["item_id"]] += quantity

        deducted_by_item_and_warehouse[
            (allocation["item_id"], allocation["warehouse_id"])
        ] += quantity

    for detail in order.details:
        detail.stock_allocations = [
            {
                **allocation,
                "released": True,
            }
            if not allocation.get("released", False)
            else allocation
            for allocation in (detail.stock_allocations or [])
        ]

    for (item_id, warehouse_id), quantity in (
        deducted_by_item_and_warehouse.items()
    ):
        db.add(
            StockLedger(
                IM_ID=item_id,
                WH_ID=warehouse_id,
                Target_WH_ID=None,
                TransactionType="STOCK_OUT",
                Quantity=quantity,
                ActualQuantity=quantity,
                ReferenceNo=reference_no,
                LoggedBy=logged_by,
                ApprovedBy=None,
                LogDate=datetime.now(),
                Remarks=(
                    f"Reserved Finished Goods deducted for "
                    f"Sales Order #{order.order_id}, "
                    f"Delivery #{delivery.delivery_id}."
                ),
            )
        )


def load_delivery(db: Session, delivery_id: int):
    return db.scalar(
        select(Delivery).where(
            Delivery.delivery_id == delivery_id
        )
    )


@router.get(
    "",
    response_model=list[DeliveryResponse],
)
def get_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = select(Delivery).order_by(
        Delivery.delivery_id.desc()
    )

    return db.scalars(statement).all()


@router.get("/warehouses")
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    warehouses = db.scalars(
        select(Warehouse).order_by(Warehouse.Warehouse_Name)
    ).all()

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

    try:
        order = db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
            .where(
                SalesOrder.order_id == delivery_data.order_id
            )
            .with_for_update()
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sales order not found.",
            )

        if order.status != "Preparing":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A delivery record can only be created "
                    "for a Sales Order with Preparing status."
                ),
            )

        for detail in order.details:
            reserved = sum(
                int(allocation.get("quantity", 0))
                for allocation in get_active_reservations(detail)
            )

            if reserved != int(detail.quantity):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Order detail for item {detail.IM_ID} "
                        "is not fully reserved. Inventory must "
                        "reserve all required quantities before delivery."
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

        if not is_finished_goods_warehouse(
            warehouse.Warehouse_Name
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Deliveries must use a Finished Goods Warehouse.",
            )

        existing_delivery = db.scalar(
            select(Delivery).where(
                Delivery.order_id == delivery_data.order_id
            )
        )

        if existing_delivery is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A delivery record already exists for this sales order.",
            )

        delivery = Delivery(
            order_id=delivery_data.order_id,
            WH_ID=delivery_data.WH_ID,
            delivery_date=delivery_data.delivery_date,
            delivery_address=delivery_data.delivery_address,
            status=PENDING_SALES,
        )

        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        return delivery

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A delivery record already exists or the delivery "
                "data conflicts with a database constraint."
            ),
        )

    except Exception:
        db.rollback()
        raise


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

        current_status = normalize_status(delivery.status)
        target_status = status_data.status

        authorize_status_update(
            current_user,
            target_status,
        )

        if current_status == target_status:
            return delivery

        allowed_transitions = {
            PENDING_SALES: [RELEASED_INVENTORY],
            RELEASED_INVENTORY: [DELIVERED_SALES],
            DELIVERED_SALES: [],
        }

        if target_status not in allowed_transitions.get(
            current_status,
            [],
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid delivery status transition: "
                    f"{current_status} to {target_status}."
                ),
            )

        order = db.scalar(
            select(SalesOrder)
            .options(selectinload(SalesOrder.details))
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

        if target_status == RELEASED_INVENTORY:
            if order.status != "Preparing":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Only Sales Orders with Preparing status "
                        "can be released by Inventory."
                    ),
                )

            deduct_delivery_stock(
                db=db,
                delivery=delivery,
                order=order,
                logged_by=current_user.user_id,
            )

            order.status = "Released to Sales"

        elif target_status == DELIVERED_SALES:
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

            if order.status != "Released to Sales":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "The Sales Order must be Released to Sales "
                        "before Sales can confirm customer receipt."
                    ),
                )

            order.status = "Completed"

        delivery.status = target_status

        db.commit()
        db.refresh(delivery)

        return delivery

    except HTTPException:
        db.rollback()
        raise

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
