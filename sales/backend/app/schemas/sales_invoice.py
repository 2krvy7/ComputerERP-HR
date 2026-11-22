
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


TaxType = Literal[
    "VAT",
    "Non-VAT",
    "Tax-Exempt",
    "Custom",
]


class SalesInvoiceCreate(BaseModel):
    order_id: int = Field(gt=0)
    invoice_date: date
    due_date: date | None = None
    installment_months: Literal[1, 3, 6, 12] = 1

    tax_type: TaxType = "VAT"
    tax_rate: Decimal | None = None

    @model_validator(mode="after")
    def validate_tax(self):
        if self.tax_type == "VAT":
            self.tax_rate = Decimal("12.00")

        elif self.tax_type in ("Non-VAT", "Tax-Exempt"):
            self.tax_rate = Decimal("0.00")

        elif self.tax_type == "Custom":
            if self.tax_rate is None:
                raise ValueError(
                    "A tax rate is required for Custom tax."
                )

            if self.tax_rate < 0 or self.tax_rate > 100:
                raise ValueError(
                    "Custom tax rate must be between 0 and 100."
                )

        return self


class SalesInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: int
    order_id: int
    invoice_date: date
    due_date: date | None
    installment_months: int
    interest_rate: Decimal
    interest_amount: Decimal
    tax_type: str
    tax_rate: Decimal
    tax_amount: Decimal
    total_due: Decimal
