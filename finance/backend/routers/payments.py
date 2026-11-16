from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/payments",
    tags=["Accounts Payable"]
)

class RecordPaymentPayload(BaseModel):
    apInvoiceID: int
    bankAccountID: int
    paymentDate: str
    amount: float

def get_exact_cols(cur, table_name: str) -> dict[str, str]:
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
    """, (table_name,))
    return {r["column_name"].lower(): r["column_name"] for r in cur.fetchall()}

@router.get("/")
def get_ap_payments():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            p_cols = get_exact_cols(cur, "APPayment")
            i_cols = get_exact_cols(cur, "APInvoice")
            s_cols = get_exact_cols(cur, "Supplier")
            b_cols = get_exact_cols(cur, "BankAccount")

            p_inv = p_cols["apinvoiceid"]
            p_bank = p_cols["bankaccountid"]
            i_pk = i_cols["apinvoiceid"]
            i_sup = i_cols["supplierid"]
            s_pk = s_cols["supplierid"]
            s_name = s_cols["suppliername"]
            b_pk = b_cols["bankaccountid"]
            b_name = b_cols["bankname"]
            b_num = b_cols["accountnumber"]

            cur.execute(f"""
                SELECT 
                    p.*,
                    i."{i_sup}" AS supplier_id,
                    s."{s_name}" AS supplier_name,
                    b."{b_name}" AS bank_name,
                    b."{b_num}" AS account_number
                FROM "APPayment" p
                LEFT JOIN "APInvoice" i ON p."{p_inv}" = i."{i_pk}"
                LEFT JOIN "Supplier" s ON i."{i_sup}" = s."{s_pk}"
                LEFT JOIN "BankAccount" b ON p."{p_bank}" = b."{b_pk}"
                ORDER BY 1 DESC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/open-bills")
def get_open_bills():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            i_cols = get_exact_cols(cur, "APInvoice")
            s_cols = get_exact_cols(cur, "Supplier")

            i_sup = i_cols["supplierid"]
            i_amt = i_cols["amount"]
            i_rem = i_cols["remainingbalance"]
            i_stat = i_cols["status"]
            i_due = i_cols["duedate"]
            s_pk = s_cols["supplierid"]
            s_name = s_cols["suppliername"]

            cur.execute(f"""
                SELECT 
                    a.*,
                    s."{s_name}" AS supplier_name
                FROM "APInvoice" a
                LEFT JOIN "Supplier" s ON a."{i_sup}" = s."{s_pk}"
                WHERE COALESCE(a."{i_rem}", a."{i_amt}") > 0
                  AND LOWER(COALESCE(a."{i_stat}", 'open')) != 'paid'
                ORDER BY a."{i_due}" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/bank-accounts")
def get_bank_accounts():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT * FROM "BankAccount" ORDER BY 1 ASC')
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/")
def record_payment(payload: RecordPaymentPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            p_cols = get_exact_cols(cur, "APPayment")
            i_cols = get_exact_cols(cur, "APInvoice")

            cur.execute(f"""
                INSERT INTO "APPayment" (
                    "{p_cols['apinvoiceid']}",
                    "{p_cols['bankaccountid']}",
                    "{p_cols['paymentdate']}",
                    "{p_cols['amount']}"
                )
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (
                payload.apInvoiceID,
                payload.bankAccountID,
                payload.paymentDate,
                payload.amount,
            ))
            created_payment = cur.fetchone()

            i_pk = i_cols["apinvoiceid"]
            i_paid = i_cols["totalpaid"]
            i_rem = i_cols["remainingbalance"]
            i_amt = i_cols["amount"]
            i_stat = i_cols["status"]

            cur.execute(f"""
                UPDATE "APInvoice"
                SET "{i_paid}" = COALESCE("{i_paid}", 0) + %s,
                    "{i_rem}" = GREATEST(COALESCE("{i_rem}", "{i_amt}") - %s, 0),
                    "{i_stat}" = CASE
                        WHEN COALESCE("{i_rem}", "{i_amt}") - %s <= 0 THEN 'Paid'
                        ELSE 'Partial'
                    END
                WHERE "{i_pk}" = %s
                RETURNING *
            """, (payload.amount, payload.amount, payload.amount, payload.apInvoiceID))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="AP Invoice not found")

            conn.commit()
            return created_payment
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()