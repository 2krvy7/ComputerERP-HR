
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SalesInvoiceCreate(BaseModel):
    order_id: int = Field(gt=0)
    invoice_date: date
    due_date: date | None = None
    installment_months: Literal[1, 3, 6, 12] = 1


class SalesInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: int
    order_id: int
    invoice_date: date
    due_date: date | None
    installment_months: int
    interest_rate: Decimal
    interest_amount: Decimal
    total_due: Decimal
