
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
        if value in ("Shipped", "Released by Inventory"):
            return "Released"

        return value


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
    received_by: str | None = None
