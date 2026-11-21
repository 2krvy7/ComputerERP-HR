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

@router.get("/")
def get_bank_transactions():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            txs = []

            # Map bankAccountID -> bank label + locate BDO Corporate Checking & BPI Payroll
            bank_map = {}
            bdo_bank = None
            payroll_bank = None
            b_table = get_exact_table_name(cur, "BankAccount")
            if b_table:
                b_cols = get_exact_cols(cur, b_table)
                b_pk = b_cols.get("bankaccountid", "bankAccountID")
                b_name = b_cols.get("bankname", "bankName")
                b_num = b_cols.get("accountnumber", "accountNumber")
                cur.execute(f'SELECT "{b_pk}" AS id, "{b_name}" AS name, "{b_num}" AS num FROM "{b_table}" ORDER BY "{b_pk}" ASC')
                for b in cur.fetchall():
                    label = f"{b['name']} ({b['num']})"
                    bank_map[b["id"]] = label
                    low = str(b["name"] or "").lower()
                    if "bdo" in low and not bdo_bank:
                        bdo_bank = {"id": b["id"], "label": label}
                    elif "payroll" in low and not payroll_bank:
                        payroll_bank = {"id": b["id"], "label": label}

            # 1. Customer Collections (ARReceipt)
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                cur.execute(f"""
                    SELECT 
                        "{r_cols.get('receiptid', 'receiptID')}" AS id,
                        "{r_cols.get('bankaccountid', 'bankAccountID')}" AS bank_id,
                        "{r_cols.get('arinvoiceid', 'arInvoiceID')}" AS ref_id,
                        "{r_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{r_cols.get('amount', 'amount')}" AS amount
                    FROM "{rec_table}"
                """)
                for r in cur.fetchall():
                    bid = r["bank_id"]
                    txs.append({
                        "id": f"REC-{r['id']}",
                        "bankAccountID": bid,
                        "bankAccountLabel": bank_map.get(bid, f"Bank #{bid}"),
                        "date": r["tx_date"],
                        "description": f"Customer Collection (AR Invoice #{r['ref_id']})",
                        "reference": f"INV-{str(r['ref_id']).zfill(4)}",
                        "amount": float(r["amount"] or 0),
                        "category": "Accounts Receivable",
                        "status": "Matched",
                    })

            # 2. Supplier Payments (APPayment)
            pay_table = get_exact_table_name(cur, "APPayment")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                cur.execute(f"""
                    SELECT 
                        "{p_cols.get('paymentid', 'paymentID')}" AS id,
                        "{p_cols.get('bankaccountid', 'bankAccountID')}" AS bank_id,
                        "{p_cols.get('apinvoiceid', 'apInvoiceID')}" AS ref_id,
                        "{p_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{p_cols.get('amount', 'amount')}" AS amount
                    FROM "{pay_table}"
                """)
                for p in cur.fetchall():
                    bid = p["bank_id"]
                    txs.append({
                        "id": f"PAY-{p['id']}",
                        "bankAccountID": bid,
                        "bankAccountLabel": bank_map.get(bid, f"Bank #{bid}"),
                        "date": p["tx_date"],
                        "description": f"Supplier Payment (AP Bill #{p['ref_id']})",
                        "reference": f"BILL-{str(p['ref_id']).zfill(4)}",
                        "amount": -abs(float(p["amount"] or 0)),
                        "category": "Accounts Payable",
                        "status": "Matched",
                    })

            # 3. Approved HR Payroll Disbursements & Direct Operating Expenses (from JournalEntry)
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            if je_table and jel_table:
                cur.execute(f"""
                    SELECT 
                        j."journalID" AS id,
                        j."referenceNo" AS ref,
                        j."sourceModule" AS mod,
                        j."description" AS descr,
                        j."journalDate" AS tx_date,
                        COALESCE(SUM(l."debit"), 0) AS amt
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" IN ('Payroll', 'Expenses')
                      AND COALESCE(l."debit", 0) > 0
                    GROUP BY j."journalID", j."referenceNo", j."sourceModule", j."description", j."journalDate"
                """)
                for je in cur.fetchall():
                    amt = float(je["amt"] or 0)
                    ref_code = je["ref"] or f"JE-{str(je['id']).zfill(4)}"
                    if je["mod"] == "Payroll":
                        if bdo_bank:
                            txs.append({
                                "id": f"JE-OUT-{je['id']}",
                                "bankAccountID": bdo_bank["id"],
                                "bankAccountLabel": bdo_bank["label"],
                                "date": je["tx_date"],
                                "description": je["descr"] or "HR Payroll Disbursement",
                                "reference": ref_code,
                                "amount": -abs(amt),
                                "category": "Payroll Expense",
                                "status": "Matched",
                            })
                        if payroll_bank:
                            txs.append({
                                "id": f"JE-IN-{je['id']}",
                                "bankAccountID": payroll_bank["id"],
                                "bankAccountLabel": payroll_bank["label"],
                                "date": je["tx_date"],
                                "description": f"Payroll Funding Received ({ref_code})",
                                "reference": ref_code,
                                "amount": abs(amt),
                                "category": "Payroll Expense",
                                "status": "Matched",
                            })
                    elif je["mod"] == "Expenses" and bdo_bank:
                        txs.append({
                            "id": f"JE-EXP-{je['id']}",
                            "bankAccountID": bdo_bank["id"],
                            "bankAccountLabel": bdo_bank["label"],
                            "date": je["tx_date"],
                            "description": je["descr"] or "Direct Operating Expense",
                            "reference": ref_code,
                            "amount": -abs(amt),
                            "category": "Operating Expense",
                            "status": "Matched",
                        })

            txs.sort(key=lambda x: str(x["date"] or ""), reverse=True)
            return txs
    finally:
        conn.close()
