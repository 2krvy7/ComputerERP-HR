from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/collections",
    tags=["AR Collections"]
)

class RecordReceiptPayload(BaseModel):
    arInvoiceID: int
    bankAccountID: int
    paymentDate: str
    amount: float

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
def get_collection_worklist():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice")
            if not ar_table:
                return []

            ar_cols = get_exact_cols(cur, ar_table)
            rem_col = ar_cols.get("remainingbalance") or ar_cols.get("amount") or "amount"
            amt_col = ar_cols.get("amount") or "amount"
            stat_col = ar_cols.get("status") or "status"
            due_col = ar_cols.get("duedate") or "dueDate"

            cust_table = get_exact_table_name(cur, "Customer")
            if cust_table:
                c_cols = get_exact_cols(cur, cust_table)
                ar_cust = ar_cols.get("customerid")
                c_pk = c_cols.get("customerid") or c_cols.get("cust_id") or c_cols.get("id")
                c_name = next((orig for low, orig in c_cols.items() if "name" in low), None)

                if ar_cust and c_pk and c_name:
                    cur.execute(f"""
                        SELECT 
                            a.*,
                            c."{c_name}" AS customer_name
                        FROM "{ar_table}" a
                        LEFT JOIN "{cust_table}" c ON a."{ar_cust}" = c."{c_pk}"
                        WHERE COALESCE(a."{rem_col}", a."{amt_col}") > 0
                          AND LOWER(COALESCE(a."{stat_col}", 'sent')) != 'paid'
                        ORDER BY a."{due_col}" ASC
                    """)
                    return cur.fetchall()

            cur.execute(f"""
                SELECT *
                FROM "{ar_table}"
                WHERE COALESCE("{rem_col}", "{amt_col}") > 0
                  AND LOWER(COALESCE("{stat_col}", 'sent')) != 'paid'
                ORDER BY "{due_col}" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/bank-accounts")
def get_bank_accounts():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            bank_table = get_exact_table_name(cur, "BankAccount")
            if not bank_table:
                return []
            cur.execute(f'SELECT * FROM "{bank_table}" ORDER BY 1 ASC')
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/receipts")
def record_ar_receipt(payload: RecordReceiptPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Collection amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            rec_table = get_exact_table_name(cur, "ARReceipt") or "ARReceipt"
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            r_cols = get_exact_cols(cur, rec_table)
            a_cols = get_exact_cols(cur, ar_table)

            # 1. Insert into ARReceipt
            cur.execute(f"""
                INSERT INTO "{rec_table}" (
                    "{r_cols.get('arinvoiceid', 'arInvoiceID')}",
                    "{r_cols.get('bankaccountid', 'bankAccountID')}",
                    "{r_cols.get('paymentdate', 'paymentDate')}",
                    "{r_cols.get('amount', 'amount')}"
                )
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (
                payload.arInvoiceID,
                payload.bankAccountID,
                payload.paymentDate,
                payload.amount,
            ))
            created_receipt = cur.fetchone()

            # 2. Update ARInvoice totalPaid, remainingBalance, and status
            pk_col = a_cols.get("arinvoiceid", "arInvoiceID")
            paid_col = a_cols.get("totalpaid", "totalPaid")
            rem_col = a_cols.get("remainingbalance", "remainingBalance")
            amt_col = a_cols.get("amount", "amount")
            stat_col = a_cols.get("status", "status")

            cur.execute(f"""
                UPDATE "{ar_table}"
                SET "{paid_col}" = COALESCE("{paid_col}", 0) + %s,
                    "{rem_col}" = GREATEST(COALESCE("{rem_col}", "{amt_col}") - %s, 0),
                    "{stat_col}" = CASE
                        WHEN COALESCE("{rem_col}", "{amt_col}") - %s <= 0 THEN 'Paid'
                        ELSE 'Partial'
                    END
                WHERE "{pk_col}" = %s
                RETURNING *
            """, (payload.amount, payload.amount, payload.amount, payload.arInvoiceID))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="AR Invoice not found")

            conn.commit()
            return created_receipt
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()