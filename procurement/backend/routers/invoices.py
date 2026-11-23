from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(prefix="/invoices", tags=["Invoices"])

# Finance's payables (APInvoice), one per purchase order, with the order, supplier and item.
# Read-only: Procurement only views these, Finance owns the payment side.
INVOICE_SELECT = """
    SELECT ap."apInvoiceID", ap."poID" AS "PO_ID",
           po."OrderDate", po."Total_Amount" AS order_total,
           s."SupplierName", im."Item_Name", rr."Quantity",
           ap."amount", ap."totalPaid", ap."remainingBalance",
           ap."status" AS payment_status, ap."dueDate"
    FROM public."APInvoice" ap
    JOIN public."PurchaseOrder" po     ON po."PO_ID" = ap."poID"
    JOIN public."RequestQuotation" rq  ON rq."RFQ_ID" = po."RFQ_ID"
    JOIN public."Supplier" s           ON s."SupplierID" = ap."supplierID"
    JOIN public."PurchaseRequest" pr   ON pr."PR_ID" = rq."PR_ID"
    JOIN public."RestockRequest" rr    ON rr."RR_ID" = pr."RestockRequestID"
    JOIN public."ITEM_MASTER" im       ON im."IM_ID" = rr."IM_ID"
"""

@router.get("/")
def list_invoices():
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(INVOICE_SELECT + ' ORDER BY ap."apInvoiceID" DESC')
            return cur.fetchall()

@router.get("/{ap_invoice_id}")
def get_invoice(ap_invoice_id: int):
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(INVOICE_SELECT + ' WHERE ap."apInvoiceID" = %s', (ap_invoice_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return row