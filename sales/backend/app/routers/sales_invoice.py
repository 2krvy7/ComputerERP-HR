
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.finance_pricing import (
    fetch_finance_pricing_alerts,
    validate_sales_price_against_finance,
)
from app.dependencies.auth import require_password_change_completed
from app.models.sales_invoice import SalesInvoice
from app.models.sales_order import SalesOrder
from app.models.sales_order_detail import SalesOrderDetail
from app.models.accounts_receivable import AccountsReceivable
from app.schemas.sales_invoice import (
    SalesInvoiceCreate,
    SalesInvoiceResponse,
)

router = APIRouter(
    prefix="/api/invoices",
    tags=["Sales Invoices"],
    dependencies=[Depends(require_password_change_completed)],
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

    finance_alerts = fetch_finance_pricing_alerts()
    order_details = db.scalars(
        select(SalesOrderDetail).where(
            SalesOrderDetail.order_id == order.order_id
        )
    ).all()

    for detail in order_details:
        unit_price = Decimal(str(detail.unit_price))
        discount = Decimal(str(detail.discount))
        discounted_vat_ex_price = unit_price * (
            Decimal("1") - discount / Decimal("100")
        )
        validate_sales_price_against_finance(
            detail.IM_ID,
            discounted_vat_ex_price,
            finance_alerts,
        )

    months = invoice_data.installment_months
    interest_rate = INTEREST_RATES[months]

    order_total = Decimal(str(order.total_amount))

    tax_rate = Decimal(str(invoice_data.tax_rate or "0.00"))

    tax_amount = (
        order_total * tax_rate / Decimal("100")
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    interest_amount = (
        order_total * interest_rate
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    total_due = order_total + tax_amount + interest_amount

    invoice = SalesInvoice(
        order_id=invoice_data.order_id,
        invoice_date=invoice_data.invoice_date,
        due_date=invoice_data.due_date,
        installment_months=months,
        interest_rate=interest_rate * 100,
        interest_amount=interest_amount,
        tax_type=invoice_data.tax_type,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
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

    except Exception:
        db.rollback()
        raise
