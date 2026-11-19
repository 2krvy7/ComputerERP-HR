from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/bank",
    tags=["Cash & Bank"]
)

class NewBankAccountPayload(BaseModel):
    bankName: str
    accountNumber: str

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

def String_pad(val) -> str:
    return str(val).zfill(4) if val is not None else "0000"

@router.get("/")
def get_bank_accounts():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            b_table = get_exact_table_name(cur, "BankAccount")
            if not b_table:
                return []

            b_cols = get_exact_cols(cur, b_table)
            b_pk = b_cols.get("bankaccountid", "bankAccountID")
            b_name = b_cols.get("bankname", "bankName")
            b_num = b_cols.get("accountnumber", "accountNumber")

            rec_table = get_exact_table_name(cur, "ARReceipt")
            pay_table = get_exact_table_name(cur, "APPayment")

            cur.execute(f'SELECT * FROM "{b_table}" ORDER BY "{b_pk}" ASC')
            banks = cur.fetchall()

            results = []
            for b in banks:
                bid = b[b_pk]
                total_in = 0.0
                total_out = 0.0
                tx_count = 0

                if rec_table:
                    r_cols = get_exact_cols(cur, rec_table)
                    r_bank = r_cols.get("bankaccountid", "bankAccountID")
                    r_amt = r_cols.get("amount", "amount")
                    cur.execute(f"""
                        SELECT COALESCE(SUM("{r_amt}"), 0) AS s, COUNT(*) AS c
                        FROM "{rec_table}" WHERE "{r_bank}" = %s
                    """, (bid,))
                    r_row = cur.fetchone()
                    total_in = float(r_row["s"])
                    tx_count += r_row["c"]

                if pay_table:
                    p_cols = get_exact_cols(cur, pay_table)
                    p_bank = p_cols.get("bankaccountid", "bankAccountID")
                    p_amt = p_cols.get("amount", "amount")
                    cur.execute(f"""
                        SELECT COALESCE(SUM("{p_amt}"), 0) AS s, COUNT(*) AS c
                        FROM "{pay_table}" WHERE "{p_bank}" = %s
                    """, (bid,))
                    p_row = cur.fetchone()
                    total_out = float(p_row["s"])
                    tx_count += p_row["c"]

                results.append({
                    "bankAccountID": bid,
                    "bankName": b[b_name],
                    "accountNumber": b[b_num],
                    "totalIn": total_in,
                    "totalOut": total_out,
                    "balance": total_in - total_out,
                    "transactionCount": tx_count,
                    "status": "Active",
                    "isDisbursement": True,
                    "isReceiver": True,
                    "purpose": "Disbursement & Receiver",
                })
            return results
    finally:
        conn.close()

@router.post("/")
def create_bank_account(payload: NewBankAccountPayload):
    if not payload.bankName.strip() or not payload.accountNumber.strip():
        raise HTTPException(status_code=400, detail="Bank name and account number are required")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            b_table = get_exact_table_name(cur, "BankAccount") or "BankAccount"
            b_cols = get_exact_cols(cur, b_table)
            b_pk = b_cols.get("bankaccountid", "bankAccountID")
            b_name = b_cols.get("bankname", "bankName")
            b_num = b_cols.get("accountnumber", "accountNumber")

            cur.execute(f"""
                INSERT INTO "{b_table}" ("{b_name}", "{b_num}")
                VALUES (%s, %s)
                RETURNING
                    "{b_pk}" AS "bankAccountID",
                    "{b_name}" AS "bankName",
                    "{b_num}" AS "accountNumber"
            """, (payload.bankName.strip(), payload.accountNumber.strip()))
            created = cur.fetchone()
            conn.commit()
            return {
                **created,
                "totalIn": 0.0,
                "totalOut": 0.0,
                "balance": 0.0,
                "transactionCount": 0,
                "status": "Active",
                "isDisbursement": True,
                "isReceiver": True,
                "purpose": "Disbursement & Receiver",
            }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/{bank_id}/transactions")
def get_bank_transactions(bank_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            txs = []
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                cur.execute(f"""
                    SELECT 
                        "{r_cols.get('receiptid', 'receiptID')}" AS id,
                        'AR Receipt' AS type,
                        "{r_cols.get('arinvoiceid', 'arInvoiceID')}" AS ref_id,
                        "{r_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{r_cols.get('amount', 'amount')}" AS amount
                    FROM "{rec_table}"
                    WHERE "{r_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """, (bank_id,))
                for r in cur.fetchall():
                    txs.append({
                        "id": f"REC-{r['id']}",
                        "type": "Deposit (AR Receipt)",
                        "reference": f"INV-{String_pad(r['ref_id'])}",
                        "date": r["tx_date"],
                        "amount": float(r["amount"] or 0),
                        "direction": "IN",
                    })

            pay_table = get_exact_table_name(cur, "APPayment")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                cur.execute(f"""
                    SELECT 
                        "{p_cols.get('paymentid', 'paymentID')}" AS id,
                        'AP Payment' AS type,
                        "{p_cols.get('apinvoiceid', 'apInvoiceID')}" AS ref_id,
                        "{p_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{p_cols.get('amount', 'amount')}" AS amount
                    FROM "{pay_table}"
                    WHERE "{p_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """, (bank_id,))
                for p in cur.fetchall():
                    txs.append({
                        "id": f"PAY-{p['id']}",
                        "type": "Disbursement (AP Payment)",
                        "reference": f"BILL-{String_pad(p['ref_id'])}",
                        "date": p["tx_date"],
                        "amount": float(p["amount"] or 0),
                        "direction": "OUT",
                    })

            txs.sort(key=lambda x: str(x["date"] or ""), reverse=True)
            return txs
    finally:
        conn.close()