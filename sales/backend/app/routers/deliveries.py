
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.delivery import Delivery
from app.models.sales_order import SalesOrder
from app.models.warehouse import Warehouse
from app.schemas.delivery import (
    DeliveryCreate,
    DeliveryResponse,
    DeliveryStatusUpdate,
)

router = APIRouter(
    prefix="/api/deliveries",
    tags=["Deliveries"],
)

ALLOWED_TRANSITIONS = {
    "Pending": ["Preparing", "Cancelled"],
    "Preparing": ["Released by Inventory", "Cancelled"],
    "Released by Inventory": ["Delivered", "Cancelled"],
    "Shipped": ["Delivered", "Cancelled"],
    "Delivered": [],
    "Cancelled": [],
}


@router.get("", response_model=list[DeliveryResponse])
def get_deliveries(db: Session = Depends(get_db)):
    statement = select(Delivery).order_by(Delivery.delivery_id.desc())
    return db.scalars(statement).all()


@router.get("/warehouses")
def get_warehouses(db: Session = Depends(get_db)):
    statement = text("""
        SELECT
            "WH_ID",
            "Warehouse_Name",
            "Location"
        FROM public."WAREHOUSE"
        ORDER BY "Warehouse_Name"
    """)
    return db.execute(statement).mappings().all()


@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    delivery = db.get(Delivery, delivery_id)

    if delivery is None:
        raise HTTPException(
            status_code=404,
            detail="Pickup record not found.",
        )

    return delivery


@router.post(
    "",
    response_model=DeliveryResponse,
    status_code=201,
)
def create_delivery(
    delivery_data: DeliveryCreate,
    db: Session = Depends(get_db),
):
    order = db.get(SalesOrder, delivery_data.order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Sales order not found.",
        )

    if order.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved sales orders can be added to customer pickup.",
        )

    warehouse = db.get(Warehouse, delivery_data.WH_ID)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    existing_pickup = db.scalar(
        select(Delivery).where(
            Delivery.order_id == delivery_data.order_id
        )
    )

    if existing_pickup is not None:
        raise HTTPException(
            status_code=409,
            detail="A pickup record already exists for this sales order.",
        )

    pickup = Delivery(
        order_id=delivery_data.order_id,
        WH_ID=delivery_data.WH_ID,
        delivery_date=delivery_data.delivery_date,
        delivery_address="",
        status="Pending",
    )

    try:
        db.add(pickup)
        db.commit()
        db.refresh(pickup)
        return pickup
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
):
    pickup = db.get(Delivery, delivery_id)

    if pickup is None:
        raise HTTPException(
            status_code=404,
            detail="Pickup record not found.",
        )

    allowed_statuses = ALLOWED_TRANSITIONS.get(
        pickup.status,
        [],
    )

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid pickup status transition: "
                f"{pickup.status} to {status_data.status}."
            ),
        )

    if status_data.status == "Delivered":
        if not status_data.received_by or not status_data.received_by.strip():
            raise HTTPException(
                status_code=400,
                detail="Customer name is required to confirm item collection.",
            )

    pickup.status = status_data.status

    try:
        db.commit()
        db.refresh(pickup)
        return pickup
    except Exception:
        db.rollback()
        raise
