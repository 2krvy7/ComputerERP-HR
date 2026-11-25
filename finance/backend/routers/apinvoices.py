from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/apinvoices",
    tags=["Accounts Payable"]
)

class CreateAPFromPIPayload(BaseModel):
    piID: int
    dueDate: str

def get_exact_cols(cur, table_name: str) -> dict[str, str]:
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND LOWER(table_name) = LOWER(%s)
    """, (table_name,))
    return {r["column_name"].lower(): r["column_name"] for r in cur.fetchall()}

def get_exact_table_name(cur, table_name: str) -> str | None:
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND LOWER(table_name) = LOWER(%s)
        LIMIT 1
    """, (table_name,))
    row = cur.fetchone()
    return row["table_name"] if row else None

@router.get("/")
def get_ap_invoices():
    """Fetches all official APInvoices joined with Supplier names."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ap_t = get_exact_table_name(cur, "APInvoice")
            if not ap_t:
                return []

            sup_t = get_exact_table_name(cur, "Supplier")
            if sup_t:
                a_cols = get_exact_cols(cur, ap_t)
                s_cols = get_exact_cols(cur, sup_t)
                a_sup = a_cols.get("supplierid")
                s_pk = s_cols.get("supplierid") or s_cols.get("id")
                s_name = next((orig for low, orig in s_cols.items() if "name" in low), None)
                if a_sup and s_pk and s_name:
                    cur.execute(f"""
                        SELECT a.*, s."{s_name}" AS supplier_name
                        FROM "{ap_t}" a
                        LEFT JOIN "{sup_t}" s ON a."{a_sup}" = s."{s_pk}"
                        ORDER BY 1 DESC
                    """)
                    return cur.fetchall()

            cur.execute(f'SELECT * FROM "{ap_t}" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/awaiting-finance")
def get_purchase_invoices_awaiting_finance():
    """Fetches Procurement PurchaseInvoices that do not have an APInvoice yet (joins Supplier via PurchaseOrder)."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pi_t = get_exact_table_name(cur, "PurchaseInvoice")
            if not pi_t:
                return []

            pi_cols = get_exact_cols(cur, pi_t)
            pi_pk = pi_cols.get("pi_id") or pi_cols.get("piid") or "PI_ID"
            pi_po = pi_cols.get("po_id") or pi_cols.get("poid") or "PO_ID"
            pi_date = pi_cols.get("invoicedate") or pi_cols.get("invoice_date") or "InvoiceDate"
            pi_due = pi_cols.get("totaldue") or pi_cols.get("total_due") or pi_cols.get("amount") or "TotalDue"

            po_t = get_exact_table_name(cur, "PurchaseOrder")
            sup_t = get_exact_table_name(cur, "Supplier")
            gr_t = get_exact_table_name(cur, "GoodsReceived")

            po_join = ""
            sup_join = ""
            gr_join = ""

            sup_id_expr = "NULL"
            sup_name_expr = "NULL"
            po_amt_expr = "NULL"
            po_stat_expr = "NULL"
            gr_id_expr = "NULL"
            gr_stat_expr = "NULL"

            if po_t:
                po_cols = get_exact_cols(cur, po_t)
                po_pk = po_cols.get("po_id") or po_cols.get("poid") or "PO_ID"
                po_sup = po_cols.get("supplierid") or po_cols.get("supplier_id")
                po_amt = po_cols.get("total_amount") or po_cols.get("totalamount")
                po_stat = po_cols.get("status")

                po_join = f'LEFT JOIN "{po_t}" po ON pi."{pi_po}" = po."{po_pk}"'
                if po_sup:
                    sup_id_expr = f'po."{po_sup}"'
                if po_amt:
                    po_amt_expr = f'po."{po_amt}"'
                if po_stat:
                    po_stat_expr = f'po."{po_stat}"'

                if sup_t and po_sup:
                    s_cols = get_exact_cols(cur, sup_t)
                    s_pk = s_cols.get("supplierid") or s_cols.get("supplier_id") or s_cols.get("id")
                    s_name = next((orig for low, orig in s_cols.items() if "name" in low), None)
                    if s_pk and s_name:
                        sup_join = f'LEFT JOIN "{sup_t}" s ON po."{po_sup}" = s."{s_pk}"'
                        sup_name_expr = f's."{s_name}"'

            if gr_t:
                gr_cols = get_exact_cols(cur, gr_t)
                gr_pk = gr_cols.get("gr_id") or gr_cols.get("grid")
                gr_po = gr_cols.get("po_id") or gr_cols.get("poid")
                gr_stat = gr_cols.get("status")
                if gr_pk and gr_po:
                    gr_join = f'LEFT JOIN "{gr_t}" gr ON pi."{pi_po}" = gr."{gr_po}"'
                    gr_id_expr = f'gr."{gr_pk}"'
                    if gr_stat:
                        gr_stat_expr = f'gr."{gr_stat}"'

            cur.execute(f"""
                SELECT 
                    pi."{pi_pk}" AS "piID",
                    pi."{pi_po}" AS "poID",
                    {sup_id_expr} AS "supplierID",
                    {sup_name_expr} AS "supplierName",
                    pi."{pi_date}" AS "invoiceDate",
                    pi."{pi_due}" AS "invoiceAmount",
                    {po_amt_expr} AS "poAmount",
                    {po_stat_expr} AS "poStatus",
                    {gr_id_expr} AS "grID",
                    {gr_stat_expr} AS "grStatus",
                    'Awaiting Finance' AS "handoffStatus"
                FROM "{pi_t}" pi
                {po_join}
                {sup_join}
                {gr_join}
                WHERE NOT EXISTS (
                    SELECT 1 FROM "APInvoice" ap WHERE ap."piID" = pi."{pi_pk}"
                )
                ORDER BY pi."{pi_pk}" DESC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/create-from-pi")
def create_ap_invoice_from_procurement(payload: CreateAPFromPIPayload):
    """Creates an official APInvoice from a verified Procurement PurchaseInvoice."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT 1 FROM "APInvoice" WHERE "piID" = %s', (payload.piID,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="AP Invoice already exists for this Purchase Invoice.")

            pi_t = get_exact_table_name(cur, "PurchaseInvoice") or "PurchaseInvoice"
            po_t = get_exact_table_name(cur, "PurchaseOrder")
            pi_cols = get_exact_cols(cur, pi_t)
            pi_pk = pi_cols.get("pi_id") or pi_cols.get("piid") or "PI_ID"
            pi_po = pi_cols.get("po_id") or pi_cols.get("poid") or "PO_ID"
            pi_due = pi_cols.get("totaldue") or pi_cols.get("total_due") or pi_cols.get("amount") or "TotalDue"

            if po_t:
                po_cols = get_exact_cols(cur, po_t)
                po_pk = po_cols.get("po_id") or po_cols.get("poid") or "PO_ID"
                po_sup = po_cols.get("supplierid") or po_cols.get("supplier_id") or "SupplierID"
                cur.execute(f"""
                    SELECT pi."{pi_pk}" AS pi_id, pi."{pi_po}" AS po_id, pi."{pi_due}" AS total_due, po."{po_sup}" AS supplier_id
                    FROM "{pi_t}" pi
                    LEFT JOIN "{po_t}" po ON pi."{pi_po}" = po."{po_pk}"
                    WHERE pi."{pi_pk}" = %s
                """, (payload.piID,))
            else:
                cur.execute(f"""
                    SELECT "{pi_pk}" AS pi_id, "{pi_po}" AS po_id, "{pi_due}" AS total_due, NULL AS supplier_id
                    FROM "{pi_t}"
                    WHERE "{pi_pk}" = %s
                """, (payload.piID,))

            pi = cur.fetchone()
            if not pi:
                raise HTTPException(status_code=404, detail="Purchase Invoice not found.")

            amount = float(pi["total_due"] or 0)
            if amount <= 0:
                raise HTTPException(status_code=400, detail="Purchase Invoice amount must be greater than 0.")

            cur.execute("""
                INSERT INTO "APInvoice" (
                    "piID", "poID", "supplierID", "amount",
                    "totalPaid", "remainingBalance", "status", "dueDate"
                )
                VALUES (%s, %s, %s, %s, 0, %s, 'Unpaid', %s)
                RETURNING *
            """, (
                pi["pi_id"],
                pi["po_id"],
                pi["supplier_id"],
                amount,
                amount,
                payload.dueDate,
            ))
            created_ap = cur.fetchone()
            conn.commit()
            return created_ap
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/procurement-status")
def get_procurement_readonly_status():
    """Read-only endpoint for Procurement to view AP status, paid amount, balance, and due date."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pi_t = get_exact_table_name(cur, "PurchaseInvoice")
            if not pi_t:
                return []

            cur.execute("""
                SELECT 
                    pi."PI_ID" AS "piID",
                    pi."PO_ID" AS "poID",
                    po."SupplierID" AS "supplierID",
                    s."SupplierName" AS "supplierName",
                    pi."InvoiceDate" AS "invoiceDate",
                    pi."TotalDue" AS "totalDue",
                    ap."apInvoiceID" AS "apInvoiceID",
                    COALESCE(ap."totalPaid", 0) AS "amountPaid",
                    COALESCE(ap."remainingBalance", pi."TotalDue") AS "remainingBalance",
                    ap."dueDate" AS "dueDate",
                    CASE
                        WHEN ap."apInvoiceID" IS NULL THEN 'Awaiting Finance'
                        WHEN COALESCE(ap."remainingBalance", 0) <= 0 OR LOWER(ap."status") = 'paid' THEN 'Paid'
                        WHEN ap."dueDate" < CURRENT_DATE THEN 'Overdue'
                        WHEN COALESCE(ap."totalPaid", 0) > 0 THEN 'Partially Paid'
                        ELSE 'Unpaid'
                    END AS "paymentStatus"
                FROM "PurchaseInvoice" pi
                LEFT JOIN "PurchaseOrder" po ON pi."PO_ID" = po."PO_ID"
                LEFT JOIN "Supplier" s ON po."SupplierID" = s."SupplierID"
                LEFT JOIN "APInvoice" ap ON pi."PI_ID" = ap."piID"
                ORDER BY pi."PI_ID" DESC
            """)
            return cur.fetchall()
    finally:
        conn.close()
