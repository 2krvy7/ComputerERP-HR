
from datetime import date
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


DeliveryStatus = Literal[
    "Pending",
    "Preparing",
    "Released",
    "Delivered",
    "Cancelled",
]


def normalize_delivery_status(value):
    if not isinstance(value, str):
        return value

    normalized = value.strip().lower()

    status_mapping = {
        "pending": "Pending",
        "preparing": "Preparing",
        "released": "Released",
        "shipped": "Released",
        "released by inventory": "Released",
        "released to sales": "Released",
        "delivered": "Delivered",
        "cancelled": "Cancelled",
        "canceled": "Cancelled",
    }

    return status_mapping.get(normalized, value)


class DeliveryCreate(BaseModel):
    order_id: int = Field(gt=0)
    WH_ID: int = Field(gt=0)
    delivery_date: date | None = None
    delivery_address: str = ""


class DeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    delivery_id: int
    order_id: int
    WH_ID: int
    delivery_date: date | None
    delivery_address: str
    status: DeliveryStatus

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
    received_by: str | None = None
