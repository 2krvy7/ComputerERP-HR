from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/transactions",
    tags=["Bank Transactions"]
)

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

def pad_id(val) -> str:
    return str(val).zfill(4) if val is not None else "0000"

@router.get("/")
def get_all_transactions():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            txs = []

            # 1. Map bank accounts
            b_table = get_exact_table_name(cur, "BankAccount")
            banks_map = {}
            if b_table:
                b_cols = get_exact_cols(cur, b_table)
                b_pk = b_cols.get("bankaccountid", "bankAccountID")
                b_name = b_cols.get("bankname", "bankName")
                b_num = b_cols.get("accountnumber", "accountNumber")
                cur.execute(f'SELECT * FROM "{b_table}"')
                for b in cur.fetchall():
                    banks_map[b[b_pk]] = f"{b[b_name]} - {b[b_num]}"

            # 2. Cash Inflows from ARReceipt
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                r_pk = r_cols.get("receiptid", "receiptID")
                r_inv = r_cols.get("arinvoiceid", "arInvoiceID")
                r_bank = r_cols.get("bankaccountid", "bankAccountID")
                r_date = r_cols.get("paymentdate", "paymentDate")
                r_amt = r_cols.get("amount", "amount")

                cur.execute(f'SELECT * FROM "{rec_table}" ORDER BY "{r_date}" DESC, "{r_pk}" DESC')
                for r in cur.fetchall():
                    inv_id = r.get(r_inv)
                    bank_id = r.get(r_bank)
                    txs.append({
                        "id": f"REC-{r[r_pk]}",
                        "rawId": r[r_pk],
                        "sourceType": "ARReceipt",
                        "bankAccountID": bank_id,
                        "bankAccountLabel": banks_map.get(bank_id, f"Account #{bank_id}"),
                        "date": r.get(r_date),
                        "description": f"Customer Receipt (AR Invoice #{inv_id})",
                        "reference": f"INV-{pad_id(inv_id)}",
                        "amount": float(r.get(r_amt) or 0),
                        "category": "Accounts Receivable",
                        "status": "Matched",
                    })

            # 3. Cash Outflows from APPayment
            pay_table = get_exact_table_name(cur, "APPayment")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                p_pk = p_cols.get("paymentid", "paymentID")
                p_inv = p_cols.get("apinvoiceid", "apInvoiceID")
                p_bank = p_cols.get("bankaccountid", "bankAccountID")
                p_date = p_cols.get("paymentdate", "paymentDate")
                p_amt = p_cols.get("amount", "amount")

                cur.execute(f'SELECT * FROM "{pay_table}" ORDER BY "{p_date}" DESC, "{p_pk}" DESC')
                for p in cur.fetchall():
                    inv_id = p.get(p_inv)
                    bank_id = p.get(p_bank)
                    txs.append({
                        "id": f"PAY-{p[p_pk]}",
                        "rawId": p[p_pk],
                        "sourceType": "APPayment",
                        "bankAccountID": bank_id,
                        "bankAccountLabel": banks_map.get(bank_id, f"Account #{bank_id}"),
                        "date": p.get(p_date),
                        "description": f"Supplier Payment (AP Bill #{inv_id})",
                        "reference": f"BILL-{pad_id(inv_id)}",
                        "amount": -abs(float(p.get(p_amt) or 0)),
                        "category": "Accounts Payable",
                        "status": "Matched",
                    })

            txs.sort(key=lambda x: str(x["date"] or ""), reverse=True)
            return txs
    finally:
        conn.close()