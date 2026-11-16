
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sales_invoice import SalesInvoice
from app.models.sales_order import SalesOrder
from app.models.accounts_receivable import AccountsReceivable
from app.schemas.sales_invoice import (
    SalesInvoiceCreate,
    SalesInvoiceResponse,
)

router = APIRouter(
    prefix="/api/invoices",
    tags=["Sales Invoices"],
)

INTEREST_RATES = {
    1: Decimal("0.00"),
    3: Decimal("0.03"),
    6: Decimal("0.05"),
    12: Decimal("0.10"),
}


@router.get("", response_model=list[SalesInvoiceResponse])
def get_invoices(db: Session = Depends(get_db)):
    statement = select(SalesInvoice).order_by(
        SalesInvoice.invoice_id.desc()
    )
    return db.scalars(statement).all()


@router.get("/{invoice_id}", response_model=SalesInvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = db.get(SalesInvoice, invoice_id)

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales invoice not found.",
        )

    return invoice


@router.post(
    "",
    response_model=SalesInvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    invoice_data: SalesInvoiceCreate,
    db: Session = Depends(get_db),
):
    order = db.get(SalesOrder, invoice_data.order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sales order not found.",
        )

    existing_invoice = db.scalar(
        select(SalesInvoice).where(
            SalesInvoice.order_id == invoice_data.order_id
        )
    )

    if existing_invoice is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This sales order already has an invoice.",
        )

    months = invoice_data.installment_months
    interest_rate = INTEREST_RATES[months]

    order_total = Decimal(str(order.total_amount))
    interest_amount = (
        order_total * interest_rate
    ).quantize(Decimal("0.01"))

    total_due = order_total + interest_amount

    invoice = SalesInvoice(
    order_id=invoice_data.order_id,
    invoice_date=invoice_data.invoice_date,
    due_date=invoice_data.due_date,
    installment_months=months,
    interest_rate=interest_rate * 100,
    interest_amount=interest_amount,
    total_due=total_due,
)

    try:
        db.add(invoice)
        db.flush()

        accounts_receivable = AccountsReceivable(
            invoice_id=invoice.invoice_id,
            customer_id=order.customer_id,
            amount_due=total_due,
            amount_paid=Decimal("0.00"),
            balance=total_due,
            status="Unpaid",
        )

        db.add(accounts_receivable)
        db.commit()
        db.refresh(invoice)

        return invoice

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create invoice and accounts receivable record.",
        )
