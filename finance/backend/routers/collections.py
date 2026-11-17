from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/collections",
    tags=["AR Collections"]
)

class NewReceiptPayload(BaseModel):
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
def get_collections():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if not rec_table:
                return []
            cur.execute(f'SELECT * FROM "{rec_table}" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/")
def record_collection(payload: NewReceiptPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Receipt amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            rec_table = get_exact_table_name(cur, "ARReceipt") or "ARReceipt"
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            r_cols = get_exact_cols(cur, rec_table)
            a_cols = get_exact_cols(cur, ar_table)

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
            created = cur.fetchone()

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
            return created
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()