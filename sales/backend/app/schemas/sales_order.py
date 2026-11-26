
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


SalesOrderStatus = Literal[
    "Pending",
    "Accepted",
    "Waiting for Stock",
    "Preparing",
    "Released to Sales",
    "Completed",
    "Cancelled",
    # Historical statuses
    "Approved",
    "Processing",
]


class SalesOrderDetailCreate(BaseModel):
    IM_ID: int = Field(gt=0)
    quantity: int = Field(gt=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class SalesOrderCreate(BaseModel):
    customer_id: int = Field(gt=0)
    quotation_id: int | None = Field(default=None, gt=0)
    order_date: date | None = None
    tax_type: Literal["VAT", "Non-VAT", "Tax-Exempt", "Custom"] = "VAT"
    tax_rate: Decimal | None = None
    installment_months: Literal[1, 3, 6, 12] = 1
    details: list[SalesOrderDetailCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_tax(self):
        if self.tax_type == "VAT":
            self.tax_rate = Decimal("12.00")
        elif self.tax_type in ("Non-VAT", "Tax-Exempt"):
            self.tax_rate = Decimal("0.00")
        elif (
            self.tax_rate is None
            or self.tax_rate < 0
            or self.tax_rate > 100
        ):
            raise ValueError(
                "Custom tax rate must be between 0 and 100."
            )

        return self


class SalesOrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_detail_id: int
    order_id: int
    IM_ID: int
    quantity: int
    unit_price: Decimal
    discount: Decimal
    line_total: Decimal


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: int
    customer_id: int
    quotation_id: int | None
    order_date: date
    status: SalesOrderStatus
    total_amount: Decimal
    tax_type: str
    tax_rate: Decimal
    tax_amount: Decimal
    installment_months: int
    details: list[SalesOrderDetailResponse]


class SalesOrderStatusUpdate(BaseModel):
    status: Literal[
        "Accepted",
        "Preparing",
        "Waiting for Stock",
        "Released to Sales",
        "Completed",
        "Cancelled",
    ]
