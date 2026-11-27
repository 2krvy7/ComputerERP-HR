
from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


DeliveryStatus = Literal[
    "pending-sales",
    "released-inventory",
    "received-sales",
    "received-customer",
]


def normalize_delivery_status(value):
    if not isinstance(value, str):
        return value

    normalized = value.strip().lower()

    status_mapping = {
        "pending": "pending-sales",
        "pending-sales": "pending-sales",
        "preparing": "pending-sales",
        "released": "released-inventory",
        "shipped": "released-inventory",
        "released by inventory": "released-inventory",
        "released to sales": "released-inventory",
        "released-inventory": "released-inventory",
        "received by sales": "received-sales",
        "received-sales": "received-sales",
        "delivered": "received-customer",
        "delivered-sales": "received-customer",
        "received by customer": "received-customer",
        "received-customer": "received-customer",
    }

    return status_mapping.get(normalized, value)


class DeliveryCreate(BaseModel):
    order_id: int = Field(gt=0)
    WH_ID: int | None = Field(default=None, gt=0)
    delivery_date: date | None = None
    delivery_address: str = ""


class DeliveryWarehouseAllocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allocation_id: int
    WH_ID: int
    quantity: int


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_id: int
    order_id: int
    WH_ID: int
    delivery_date: date | None
    delivery_address: str
    status: DeliveryStatus
    received_by: str | None = None
    received_at: datetime | None = None
    warehouse_allocations: list[DeliveryWarehouseAllocationResponse] = []

    @field_validator("status", mode="before")
    @classmethod
    def convert_legacy_status(cls, value):
        return normalize_delivery_status(value)

    @field_validator("delivery_address", mode="before")
    @classmethod
    def normalize_delivery_address(cls, value):
        return value or ""


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
    received_by: str | None = Field(default=None, max_length=150)
