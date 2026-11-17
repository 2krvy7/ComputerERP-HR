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

            cust_table = get_exact_table_name(cur, "Customer")
            if cust_table:
                ar_cols = get_exact_cols(cur, ar_table)
                c_cols = get_exact_cols(cur, cust_table)
                ar_cust = ar_cols.get("customerid")
                c_pk = c_cols.get("customerid") or c_cols.get("cust_id") or c_cols.get("id")
                # Match any column containing "name" (e.g., CustomerName, Customer_Name, FullName)
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
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()