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
            b_disb = b_cols.get("isdisbursement")
            b_rec = b_cols.get("isreceiver")

            rec_table = get_exact_table_name(cur, "ARReceipt")
            pay_table = get_exact_table_name(cur, "APPayment")
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")

            # Total approved HR Payroll from JournalEntry (sourceModule = 'Payroll')
            payroll_total = 0.0
            payroll_count = 0
            if je_table and jel_table:
                cur.execute(f"""
                    SELECT COALESCE(SUM(l."debit"), 0) AS s, COUNT(DISTINCT j."journalID") AS c
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" = 'Payroll' AND COALESCE(l."debit", 0) > 0
                """)
                pr_row = cur.fetchone()
                payroll_total = float(pr_row["s"] or 0)
                payroll_count = int(pr_row["c"] or 0)

            cur.execute(f'SELECT * FROM "{b_table}" ORDER BY "{b_pk}" ASC')
            banks = cur.fetchall()

            results = []
            for b in banks:
                bid = b[b_pk]
                name_str = str(b[b_name] or "")
                name_low = name_str.lower()
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

                is_disb = bool(b[b_disb]) if b_disb and b.get(b_disb) is not None else True
                is_rec = bool(b[b_rec]) if b_rec and b.get(b_rec) is not None else True

                # Count approved HR Payroll as Outflow on BDO Corporate Checking & Inflow on BPI Payroll
                if "bdo" in name_low or (is_disb and "payroll" not in name_low and "sales" not in name_low):
                    total_out += payroll_total
                    tx_count += payroll_count
                elif "payroll" in name_low:
                    total_in += payroll_total
                    tx_count += payroll_count

                results.append({
                    "bankAccountID": bid,
                    "bankName": name_str,
                    "accountNumber": b[b_num],
                    "totalIn": total_in,
                    "totalOut": total_out,
                    "balance": total_in - total_out,
                    "transactionCount": tx_count,
                    "isDisbursement": is_disb,
                    "isReceiver": is_rec,
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


@router.get("/transactions")
def get_all_bank_transactions():
    """Returns all AR Receipts, AP Payments, HR Payroll disbursements, and Direct Expenses across all banks."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            txs = []

            # Map bankAccountID -> bankName
            bank_map = {}
            bdo_name = "BDO Corporate Checking"
            payroll_bank_name = "BPI Payroll"
            b_table = get_exact_table_name(cur, "BankAccount")
            if b_table:
                b_cols = get_exact_cols(cur, b_table)
                b_pk = b_cols.get("bankaccountid", "bankAccountID")
                b_name = b_cols.get("bankname", "bankName")
                cur.execute(f'SELECT "{b_pk}" AS id, "{b_name}" AS name FROM "{b_table}"')
                for b in cur.fetchall():
                    bank_map[b["id"]] = b["name"]
                    low = str(b["name"] or "").lower()
                    if "bdo" in low:
                        bdo_name = b["name"]
                    elif "payroll" in low:
                        payroll_bank_name = b["name"]

            # 1. Customer Deposits (ARReceipt)
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
                    txs.append({
                        "id": f"REC-{r['id']}",
                        "bankName": bank_map.get(r["bank_id"], f"Bank #{r['bank_id']}"),
                        "type": "Deposit (AR Receipt)",
                        "reference": f"INV-{String_pad(r['ref_id'])}",
                        "date": r["tx_date"],
                        "amount": float(r["amount"] or 0),
                        "direction": "IN",
                    })

            # 2. Supplier Disbursements (APPayment)
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
                    txs.append({
                        "id": f"PAY-{p['id']}",
                        "bankName": bank_map.get(p["bank_id"], f"Bank #{p['bank_id']}"),
                        "type": "Disbursement (AP Payment)",
                        "reference": f"BILL-{String_pad(p['ref_id'])}",
                        "date": p["tx_date"],
                        "amount": float(p["amount"] or 0),
                        "direction": "OUT",
                    })

            # 3. Approved HR Payroll Disbursements (JournalEntry where sourceModule = 'Payroll')
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            if je_table and jel_table:
                cur.execute(f"""
                    SELECT 
                        j."journalID" AS id,
                        j."referenceNo" AS ref,
                        j."description" AS descr,
                        j."journalDate" AS tx_date,
                        COALESCE(SUM(l."debit"), 0) AS amt
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" = 'Payroll' AND COALESCE(l."debit", 0) > 0
                    GROUP BY j."journalID", j."referenceNo", j."description", j."journalDate"
                """)
                for pr in cur.fetchall():
                    amt = float(pr["amt"] or 0)
                    ref_code = pr["ref"] or f"PAYROLL-{pr['id']}"
                    # Outflow from BDO Corporate Checking
                    txs.append({
                        "id": f"JE-OUT-{pr['id']}",
                        "bankName": bdo_name,
                        "type": "Disbursement (HR Payroll)",
                        "reference": ref_code,
                        "date": pr["tx_date"],
                        "amount": amt,
                        "direction": "OUT",
                    })
                    # Inflow into BPI Payroll
                    txs.append({
                        "id": f"JE-IN-{pr['id']}",
                        "bankName": payroll_bank_name,
                        "type": "Deposit (HR Payroll Transfer)",
                        "reference": ref_code,
                        "date": pr["tx_date"],
                        "amount": amt,
                        "direction": "IN",
                    })

            txs.sort(key=lambda x: str(x["date"] or ""), reverse=True)
            return txs
    finally:
        conn.close()

@router.get("/{bank_id}/transactions")
def get_bank_transactions(bank_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            txs = []
            b_table = get_exact_table_name(cur, "BankAccount")
            bank_name_low = ""
            is_disb = False
            if b_table:
                b_cols = get_exact_cols(cur, b_table)
                cur.execute(f'SELECT * FROM "{b_table}" WHERE "{b_cols.get("bankaccountid", "bankAccountID")}" = %s', (bank_id,))
                b_row = cur.fetchone()
                if b_row:
                    bank_name_low = str(b_row.get(b_cols.get("bankname", "bankName")) or "").lower()
                    is_disb = bool(b_row.get(b_cols.get("isdisbursement", "isDisbursement")))

            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                cur.execute(f"""
                    SELECT 
                        "{r_cols.get('receiptid', 'receiptID')}" AS id,
                        'Deposit (AR Receipt)' AS type,
                        "{r_cols.get('arinvoiceid', 'arInvoiceID')}" AS ref_id,
                        "{r_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{r_cols.get('amount', 'amount')}" AS amount
                    FROM "{rec_table}"
                    WHERE "{r_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """, (bank_id,))
                for r in cur.fetchall():
                    txs.append({
                        "id": f"REC-{r['id']}",
                        "type": r["type"],
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
                        'Disbursement (AP Payment)' AS type,
                        "{p_cols.get('apinvoiceid', 'apInvoiceID')}" AS ref_id,
                        "{p_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{p_cols.get('amount', 'amount')}" AS amount
                    FROM "{pay_table}"
                    WHERE "{p_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """, (bank_id,))
                for p in cur.fetchall():
                    txs.append({
                        "id": f"PAY-{p['id']}",
                        "type": p["type"],
                        "reference": f"BILL-{String_pad(p['ref_id'])}",
                        "date": p["tx_date"],
                        "amount": float(p["amount"] or 0),
                        "direction": "OUT",
                    })

            # Include approved HR Payroll entries on BDO Corporate Checking (OUT) & BPI Payroll (IN)
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            if je_table and jel_table:
                is_bdo = "bdo" in bank_name_low or (is_disb and "payroll" not in bank_name_low and "sales" not in bank_name_low)
                is_payroll_bank = "payroll" in bank_name_low

                if is_bdo or is_payroll_bank:
                    cur.execute(f"""
                        SELECT j."journalID" AS id, j."referenceNo" AS ref, j."journalDate" AS tx_date, COALESCE(SUM(l."debit"), 0) AS amt
                        FROM "{je_table}" j
                        JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                        WHERE j."sourceModule" = 'Payroll' AND COALESCE(l."debit", 0) > 0
                        GROUP BY j."journalID", j."referenceNo", j."journalDate"
                    """)
                    for pr in cur.fetchall():
                        txs.append({
                            "id": f"JE-{pr['id']}",
                            "type": "Disbursement (HR Payroll)" if is_bdo else "Deposit (HR Payroll Transfer)",
                            "reference": pr["ref"] or f"PAYROLL-{pr['id']}",
                            "date": pr["tx_date"],
                            "amount": float(pr["amt"] or 0),
                            "direction": "OUT" if is_bdo else "IN",
                        })

            txs.sort(key=lambda x: str(x["date"] or ""), reverse=True)
            return txs
    finally:
        conn.close()


class BankRolePayload(BaseModel):
    isDisbursement: bool
    isReceiver: bool

@router.patch("/{bank_id}/roles")
def update_bank_roles(bank_id: int, payload: BankRolePayload):
    """Toggles whether a BankAccount is active for Disbursements (AP) or Receiving (AR)."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            b_table = get_exact_table_name(cur, "BankAccount") or "BankAccount"
            b_cols = get_exact_cols(cur, b_table)
            b_pk = b_cols.get("bankaccountid", "bankAccountID")
            disb_col = b_cols.get("isdisbursement", "isDisbursement")
            rec_col = b_cols.get("isreceiver", "isReceiver")

            cur.execute(f"""
                UPDATE "{b_table}"
                SET "{disb_col}" = %s,
                    "{rec_col}" = %s
                WHERE "{b_pk}" = %s
                RETURNING *
            """, (payload.isDisbursement, payload.isReceiver, bank_id))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Bank account not found")
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


class BankTransferPayload(BaseModel):
    fromBankID: int
    toBankID: int
    amount: float
    transferDate: str

@router.post("/transfer")
def transfer_between_banks(payload: BankTransferPayload):
    """Transfers collected funds from BPI Sales into BDO Corporate Checking."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than 0")
    if payload.fromBankID == payload.toBankID:
        raise HTTPException(status_code=400, detail="Source and destination banks must be different")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # 1. Record Outflow from Source Bank (BPI Sales)
            ap_t = get_exact_table_name(cur, "APInvoice")
            pay_t = get_exact_table_name(cur, "APPayment")
            if ap_t and pay_t:
                cur.execute(f"""
                    INSERT INTO "{ap_t}" ("amount", "totalPaid", "remainingBalance", "status", "dueDate")
                    VALUES (%s, %s, 0, 'Paid', %s)
                    RETURNING "apInvoiceID"
                """, (payload.amount, payload.amount, payload.transferDate))
                ap_id = cur.fetchone()["apInvoiceID"]

                cur.execute(f"""
                    INSERT INTO "{pay_t}" ("apInvoiceID", "bankAccountID", "paymentDate", "amount")
                    VALUES (%s, %s, %s, %s)
                """, (ap_id, payload.fromBankID, payload.transferDate, payload.amount))

            # 2. Record Inflow into Destination Bank (BDO Corporate Checking)
            ar_t = get_exact_table_name(cur, "ARInvoice")
            rec_t = get_exact_table_name(cur, "ARReceipt")
            if ar_t and rec_t:
                cur.execute(f"""
                    INSERT INTO "{ar_t}" ("amount", "totalPaid", "remainingBalance", "status", "dueDate")
                    VALUES (%s, %s, 0, 'Paid', %s)
                    RETURNING "arInvoiceID"
                """, (payload.amount, payload.amount, payload.transferDate))
                ar_id = cur.fetchone()["arInvoiceID"]

                cur.execute(f"""
                    INSERT INTO "{rec_t}" ("arInvoiceID", "bankAccountID", "paymentDate", "amount")
                    VALUES (%s, %s, %s, %s)
                """, (ar_id, payload.toBankID, payload.transferDate, payload.amount))

            # 3. Record Balanced Internal Transfer Journal Entry
            je_t = get_exact_table_name(cur, "JournalEntry")
            jel_t = get_exact_table_name(cur, "JournalEntryLine")
            coa_t = get_exact_table_name(cur, "ChartOfAccounts")
            if je_t and jel_t and coa_t:
                cur.execute(f'SELECT "accountID" FROM "{coa_t}" WHERE "accountCode" IN (\'1020\', \'1010\') OR "accountName" ILIKE \'%Bank%\' LIMIT 1')
                cash_acc = cur.fetchone()
                if cash_acc:
                    cur.execute(f"""
                        INSERT INTO "{je_t}" ("journalDate", "referenceNo", "sourceModule", "description")
                        VALUES (%s, 'XFER-BANK', 'Cash Transfer', %s)
                        RETURNING "journalID"
                    """, (payload.transferDate, f"Inter-bank sweep from Bank #{payload.fromBankID} to Bank #{payload.toBankID}"))
                    jid = cur.fetchone()["journalID"]
                    cur.execute(f'UPDATE "{je_t}" SET "referenceNo" = %s WHERE "journalID" = %s', (f"XFER-{str(jid).zfill(4)}", jid))
                    cur.execute(f'INSERT INTO "{jel_t}" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, cash_acc["accountID"], payload.amount))
                    cur.execute(f'INSERT INTO "{jel_t}" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, cash_acc["accountID"], payload.amount))

            conn.commit()
            return {"message": f"Transferred {payload.amount} to Corporate Checking"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()