from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/arinvoices",
    tags=["Accounts Receivable"]
)

class NewARInvoicePayload(BaseModel):
    customerID: int
    salesInvoiceID: int | None = None
    amount: float
    dueDate: str
    status: str = "Sent"

class SalesInvoiceWebhookPayload(BaseModel):
    salesInvoiceID: int
    customerID: int
    amount: float
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
def get_ar_invoices():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice")
            if not ar_table:
                return []

            ar_cols = get_exact_cols(cur, ar_table)
            rec_table = get_exact_table_name(cur, "ARReceipt")

            # Auto-sync ARInvoice totalPaid, remainingBalance, and status from ARReceipt
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                ar_pk = ar_cols.get("arinvoiceid", "arInvoiceID")
                ar_amt = ar_cols.get("amount", "amount")
                ar_paid = ar_cols.get("totalpaid", "totalPaid")
                ar_rem = ar_cols.get("remainingbalance", "remainingBalance")
                ar_stat = ar_cols.get("status", "status")
                r_inv = r_cols.get("arinvoiceid", "arInvoiceID")
                r_amt = r_cols.get("amount", "amount")

                cur.execute(f"""
                    UPDATE "{ar_table}" a
                    SET "{ar_paid}" = COALESCE(r.paid_sum, 0),
                        "{ar_rem}" = GREATEST(a."{ar_amt}" - COALESCE(r.paid_sum, 0), 0),
                        "{ar_stat}" = CASE
                            WHEN a."{ar_amt}" - COALESCE(r.paid_sum, 0) <= 0 THEN 'Paid'
                            WHEN COALESCE(r.paid_sum, 0) > 0 THEN 'Partial'
                            ELSE a."{ar_stat}"
                        END
                    FROM (
                        SELECT "{r_inv}" AS inv_id, COALESCE(SUM("{r_amt}"), 0) AS paid_sum
                        FROM "{rec_table}"
                        GROUP BY "{r_inv}"
                    ) r
                    WHERE a."{ar_pk}" = r.inv_id
                """)
                conn.commit()

            cust_table = get_exact_table_name(cur, "Customer")
            if cust_table:
                c_cols = get_exact_cols(cur, cust_table)
                ar_cust = ar_cols.get("customerid")
                c_pk = c_cols.get("customerid") or c_cols.get("cust_id") or c_cols.get("id")
                c_name = next(
                    (orig for low, orig in c_cols.items() if "name" in low),
                    None,
                )
                if ar_cust and c_pk and c_name:
                    cur.execute(f"""
                        SELECT 
                            a.*,
                            c."{c_name}" AS customer_name
                        FROM "{ar_table}" a
                        LEFT JOIN "{cust_table}" c ON a."{ar_cust}" = c."{c_pk}"
                        ORDER BY 1 DESC
                    """)
                    return cur.fetchall()

            cur.execute(f'SELECT * FROM "{ar_table}" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()


@router.get("/customers")
def get_customers():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cust_table = get_exact_table_name(cur, "Customer")
            if not cust_table:
                return []
            cur.execute(f'SELECT * FROM "{cust_table}" ORDER BY 1 ASC')
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/receipts-summary")
def get_receipts_summary():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if not rec_table:
                return {"totalCollected": 0, "receiptCount": 0}
            r_cols = get_exact_cols(cur, rec_table)
            amt_col = r_cols.get("amount") or "amount"
            cur.execute(f"""
                SELECT 
                    COALESCE(SUM("{amt_col}"), 0) AS total_collected,
                    COUNT(*) AS receipt_count
                FROM "{rec_table}"
            """)
            row = cur.fetchone()
            return {
                "totalCollected": float(row["total_collected"]),
                "receiptCount": row["receipt_count"]
            }
    finally:
        conn.close()

@router.post("/")
def create_ar_invoice(payload: NewARInvoicePayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invoice amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)

            insert_cols = []
            insert_vals = []
            field_map = {
                "customerid": payload.customerID,
                "salesinvoiceid": payload.salesInvoiceID,
                "amount": payload.amount,
                "totalpaid": 0,
                "remainingbalance": payload.amount,
                "status": payload.status,
                "duedate": payload.dueDate,
            }

            for key, val in field_map.items():
                if key in cols and val is not None:
                    insert_cols.append(f'"{cols[key]}"')
                    insert_vals.append(val)

            col_sql = ", ".join(insert_cols)
            ph_sql = ", ".join(["%s"] * len(insert_vals))

            cur.execute(f"""
                INSERT INTO "{ar_table}" ({col_sql})
                VALUES ({ph_sql})
                RETURNING *
            """, tuple(insert_vals))
            created = cur.fetchone()
            conn.commit()
            return created
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.patch("/{invoice_id}/status")
def update_ar_status(invoice_id: int, status: str = "Sent"):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)
            pk_col = cols.get("arinvoiceid") or "arInvoiceID"
            stat_col = cols.get("status") or "status"
            rem_col = cols.get("remainingbalance") or "remainingBalance"
            paid_col = cols.get("totalpaid") or "totalPaid"
            amt_col = cols.get("amount") or "amount"

            if status.lower() == "paid":
                cur.execute(f"""
                    UPDATE "{ar_table}"
                    SET "{stat_col}" = 'Paid',
                        "{paid_col}" = "{amt_col}",
                        "{rem_col}" = 0
                    WHERE "{pk_col}" = %s
                    RETURNING *
                """, (invoice_id,))
            else:
                cur.execute(f"""
                    UPDATE "{ar_table}"
                    SET "{stat_col}" = %s
                    WHERE "{pk_col}" = %s
                    RETURNING *
                """, (status, invoice_id))

            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="AR Invoice not found")
            conn.commit()
            return updated
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/from-sales")
def receive_sales_invoice(payload: SalesInvoiceWebhookPayload):
    """Team 4 (Sales) calls this endpoint when a customer Sales Invoice is issued."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Sales invoice amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)
            si_col = cols.get("salesinvoiceid", "salesInvoiceID")

            cur.execute(f'SELECT 1 FROM "{ar_table}" WHERE "{si_col}" = %s', (payload.salesInvoiceID,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="AR Invoice already exists for this Sales Invoice.")

            insert_cols = []
            insert_vals = []
            field_map = {
                "customerid": payload.customerID,
                "salesinvoiceid": payload.salesInvoiceID,
                "amount": payload.amount,
                "totalpaid": 0,
                "remainingbalance": payload.amount,
                "status": "Sent",
                "duedate": payload.dueDate,
            }

            for key, val in field_map.items():
                if key in cols and val is not None:
                    insert_cols.append(f'"{cols[key]}"')
                    insert_vals.append(val)

            col_sql = ", ".join(insert_cols)
            ph_sql = ", ".join(["%s"] * len(insert_vals))

            cur.execute(f"""
                INSERT INTO "{ar_table}" ({col_sql})
                VALUES ({ph_sql})
                RETURNING *
            """, tuple(insert_vals))
            created = cur.fetchone()
            conn.commit()
            return {"message": "Sales Invoice synced to Accounts Receivable", "arInvoice": created}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/sync-sales")
def sync_from_sales_table():
    """Pulls unimported rows from Team 4's Sales Invoice table into Finance's ARInvoice table."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            sales_table = (
                get_exact_table_name(cur, "Sales Invoice")
                or get_exact_table_name(cur, "SalesInvoice")
                or get_exact_table_name(cur, "SALES_INVOICE")
            )
            if not sales_table:
                return {"syncedCount": 0, "message": "Sales Invoice table not found in database"}

            ar_cols = get_exact_cols(cur, ar_table)
            s_cols = get_exact_cols(cur, sales_table)

            s_pk = s_cols.get("salesinvoice_id") or s_cols.get("salesinvoiceid") or s_cols.get("si_id") or s_cols.get("id")
            s_cust = s_cols.get("customerid") or s_cols.get("customer_id")
            s_amt = s_cols.get("totalamount") or s_cols.get("total_amount") or s_cols.get("amount") or s_cols.get("totaldue")
            s_date = s_cols.get("invoicedate") or s_cols.get("invoice_date")

            if not (s_pk and s_cust and s_amt):
                raise HTTPException(status_code=400, detail="Could not match columns on Sales Invoice table.")

            date_expr = f'COALESCE(si."{s_date}", CURRENT_DATE) + INTERVAL \'30 days\'' if s_date else "CURRENT_DATE + INTERVAL '30 days'"

            cur.execute(f"""
                INSERT INTO "{ar_table}" (
                    "{ar_cols.get('salesinvoiceid', 'salesInvoiceID')}",
                    "{ar_cols.get('customerid', 'customerID')}",
                    "{ar_cols.get('amount', 'amount')}",
                    "{ar_cols.get('totalpaid', 'totalPaid')}",
                    "{ar_cols.get('remainingbalance', 'remainingBalance')}",
                    "{ar_cols.get('status', 'status')}",
                    "{ar_cols.get('duedate', 'dueDate')}"
                )
                SELECT 
                    si."{s_pk}",
                    si."{s_cust}",
                    si."{s_amt}",
                    0,
                    si."{s_amt}",
                    'Sent',
                    {date_expr}
                FROM "{sales_table}" si
                WHERE NOT EXISTS (
                    SELECT 1 FROM "{ar_table}" ar
                    WHERE ar."{ar_cols.get('salesinvoiceid', 'salesInvoiceID')}" = si."{s_pk}"
                )
                RETURNING *
            """)
            synced = cur.fetchall()
            conn.commit()
            return {"syncedCount": len(synced), "invoices": synced}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()