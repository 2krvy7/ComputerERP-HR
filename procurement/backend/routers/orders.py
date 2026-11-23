from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(prefix="/orders", tags=["Orders"])

# One query joins the whole chain: order -> winning bid -> supplier -> request -> item and warehouse.
# The two LEFT JOINs add delivery info (Inventory's count) and Finance's payment info.
# "invoiced" now means Finance has fully paid the order. The old tax columns stay in the
# response as empty values, so the pages that still read them keep working.
ORDER_SELECT = """
    SELECT po."PO_ID", po."OrderDate", po."Total_Amount",
           rq."RFQ_ID", rq."QuotedAmount" AS unit_price, rq."DeliveryTerms",
           s."SupplierID", s."SupplierName",
           pr."PR_ID", rr."Quantity",
           im."Item_Name", im."SKU", w."Warehouse_Name",
           (gr."QuantityReceived" IS NOT NULL) AS goods_received,
           gr."ReceivedDate", gr."ItemCondition", gr."QuantityReceived", gr."Remarks",
           (LOWER(COALESCE(ap."status", '')) = 'paid') AS invoiced,
           NULL::date    AS "InvoiceDate",
           NULL::numeric AS "TaxAmount",
           ap."amount"   AS "TotalDue",
           ap."apInvoiceID", ap."status" AS payment_status,
           ap."totalPaid", ap."remainingBalance"
    FROM public."PurchaseOrder" po
    JOIN public."RequestQuotation" rq ON rq."RFQ_ID" = po."RFQ_ID"
    JOIN public."Supplier" s          ON s."SupplierID" = rq."SupplierID"
    JOIN public."PurchaseRequest" pr  ON pr."PR_ID" = rq."PR_ID"
    JOIN public."RestockRequest" rr   ON rr."RR_ID" = pr."RestockRequestID"
    JOIN public."ITEM_MASTER" im      ON im."IM_ID" = rr."IM_ID"
    JOIN public."WAREHOUSE" w         ON w."WH_ID" = rr."WH_ID"
    LEFT JOIN public."GoodsReceived" gr ON gr."PO_ID" = po."PO_ID"
    LEFT JOIN public."APInvoice" ap     ON ap."poID" = po."PO_ID"
"""

@router.get("/")
def list_orders():
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(ORDER_SELECT + ' ORDER BY po."PO_ID" DESC')
            return cur.fetchall()

@router.get("/{po_id}")
def get_order(po_id: int):
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(ORDER_SELECT + ' WHERE po."PO_ID" = %s', (po_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return row