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

            # 1. Total approved HR Payroll & Direct Operating Expenses from JournalEntry
            payroll_total = 0.0
            payroll_count = 0
            direct_exp_total = 0.0
            direct_exp_count = 0
            transfers = []

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

                cur.execute(f"""
                    SELECT COALESCE(SUM(l."debit"), 0) AS s, COUNT(DISTINCT j."journalID") AS c
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" = 'Expenses' AND COALESCE(l."debit", 0) > 0
                """)
                exp_row = cur.fetchone()
                direct_exp_total = float(exp_row["s"] or 0)
                direct_exp_count = int(exp_row["c"] or 0)

                cur.execute(f"""
                    SELECT j."description" AS descr, COALESCE(SUM(l."debit"), 0) AS amt
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" = 'Cash Transfer' AND COALESCE(l."debit", 0) > 0
                    GROUP BY j."journalID", j."description"
                """)
                transfers = cur.fetchall()

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

                # 2. Count approved HR Payroll & Direct Operating Expenses on BDO Corporate Checking / BPI Payroll
                if "bdo" in name_low or (is_disb and "payroll" not in name_low and "sales" not in name_low):
                    total_out += payroll_total + direct_exp_total
                    tx_count += payroll_count + direct_exp_count
                elif "payroll" in name_low:
                    total_in += payroll_total
                    tx_count += payroll_count

                # 3. Apply inter-bank Cash Transfers ([FROM:id|TO:id])
                for xfer in transfers:
                    d_str = str(xfer["descr"] or "")
                    x_amt = float(xfer["amt"] or 0)
                    if f"[FROM:{bid}|" in d_str:
                        total_out += x_amt
                        tx_count += 1
                    if f"|TO:{bid}]" in d_str:
                        total_in += x_amt
                        tx_count += 1

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
                cur.execute(
                    f'SELECT * FROM "{b_table}" WHERE "{b_cols.get("bankaccountid", "bankAccountID")}" = %s',
                    (bank_id,),
                )
                b_row = cur.fetchone()
                if b_row:
                    bank_name_low = str(b_row.get(b_cols.get("bankname", "bankName")) or "").lower()
                    is_disb = bool(b_row.get(b_cols.get("isdisbursement", "isDisbursement")))

            # 1. Deposits from ARReceipt
            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                cur.execute(
                    f"""
                    SELECT 
                        "{r_cols.get('receiptid', 'receiptID')}" AS id,
                        'Deposit (AR Receipt)' AS type,
                        "{r_cols.get('arinvoiceid', 'arInvoiceID')}" AS ref_id,
                        "{r_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{r_cols.get('amount', 'amount')}" AS amount
                    FROM "{rec_table}"
                    WHERE "{r_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """,
                    (bank_id,),
                )
                for r in cur.fetchall():
                    txs.append({
                        "id": f"REC-{r['id']}",
                        "type": r["type"],
                        "reference": f"INV-{String_pad(r['ref_id'])}",
                        "date": r["tx_date"],
                        "amount": float(r["amount"] or 0),
                        "direction": "IN",
                    })

            # 2. Disbursements from APPayment
            pay_table = get_exact_table_name(cur, "APPayment")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                cur.execute(
                    f"""
                    SELECT 
                        "{p_cols.get('paymentid', 'paymentID')}" AS id,
                        'Disbursement (AP Payment)' AS type,
                        "{p_cols.get('apinvoiceid', 'apInvoiceID')}" AS ref_id,
                        "{p_cols.get('paymentdate', 'paymentDate')}" AS tx_date,
                        "{p_cols.get('amount', 'amount')}" AS amount
                    FROM "{pay_table}"
                    WHERE "{p_cols.get('bankaccountid', 'bankAccountID')}" = %s
                """,
                    (bank_id,),
                )
                for p in cur.fetchall():
                    txs.append({
                        "id": f"PAY-{p['id']}",
                        "type": p["type"],
                        "reference": f"BILL-{String_pad(p['ref_id'])}",
                        "date": p["tx_date"],
                        "amount": float(p["amount"] or 0),
                        "direction": "OUT",
                    })

            # 3. JournalEntry-backed Payroll, Direct Expenses, and Inter-Bank Cash Transfers
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            if je_table and jel_table:
                is_bdo = "bdo" in bank_name_low or (
                    is_disb and "payroll" not in bank_name_low and "sales" not in bank_name_low
                )
                is_payroll_bank = "payroll" in bank_name_low

                # HR Payroll runs (OUT on BDO, IN on BPI Payroll)
                if is_bdo or is_payroll_bank:
                    cur.execute(
                        f"""
                        SELECT j."journalID" AS id, j."referenceNo" AS ref, j."journalDate" AS tx_date,
                               COALESCE(SUM(l."debit"), 0) AS amt
                        FROM "{je_table}" j
                        JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                        WHERE j."sourceModule" = 'Payroll' AND COALESCE(l."debit", 0) > 0
                        GROUP BY j."journalID", j."referenceNo", j."journalDate"
                    """
                    )
                    for pr in cur.fetchall():
                        txs.append({
                            "id": f"JE-PR-{pr['id']}",
                            "type": "Disbursement (HR Payroll)" if is_bdo else "Deposit (HR Payroll Transfer)",
                            "reference": pr["ref"] or f"PAYROLL-{pr['id']}",
                            "date": pr["tx_date"],
                            "amount": float(pr["amt"] or 0),
                            "direction": "OUT" if is_bdo else "IN",
                        })

                # Direct Operating Expenses (OUT on BDO Corporate Checking)
                if is_bdo:
                    cur.execute(
                        f"""
                        SELECT j."journalID" AS id, j."referenceNo" AS ref, j."description" AS descr,
                               j."journalDate" AS tx_date, COALESCE(SUM(l."debit"), 0) AS amt
                        FROM "{je_table}" j
                        JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                        WHERE j."sourceModule" = 'Expenses' AND COALESCE(l."debit", 0) > 0
                        GROUP BY j."journalID", j."referenceNo", j."description", j."journalDate"
                    """
                    )
                    for exp in cur.fetchall():
                        txs.append({
                            "id": f"JE-EXP-{exp['id']}",
                            "type": f"Disbursement ({exp['descr'] or 'Operating Expense'})",
                            "reference": exp["ref"] or f"EXP-{exp['id']}",
                            "date": exp["tx_date"],
                            "amount": float(exp["amt"] or 0),
                            "direction": "OUT",
                        })

                # Inter-Bank Cash Transfers ([FROM:id|TO:id])
                cur.execute(
                    f"""
                    SELECT j."journalID" AS id, j."referenceNo" AS ref, j."description" AS descr,
                           j."journalDate" AS tx_date, COALESCE(SUM(l."debit"), 0) AS amt
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" = 'Cash Transfer' AND COALESCE(l."debit", 0) > 0
                    GROUP BY j."journalID", j."referenceNo", j."description", j."journalDate"
                """
                )
                for xfer in cur.fetchall():
                    d_str = str(xfer["descr"] or "")
                    x_amt = float(xfer["amt"] or 0)
                    ref_code = xfer["ref"] or f"XFER-{xfer['id']}"
                    if f"[FROM:{bank_id}|" in d_str:
                        txs.append({
                            "id": f"XFER-OUT-{xfer['id']}",
                            "type": "Transfer Out (to Corporate Checking)",
                            "reference": ref_code,
                            "date": xfer["tx_date"],
                            "amount": x_amt,
                            "direction": "OUT",
                        })
                    elif f"|TO:{bank_id}]" in d_str:
                        txs.append({
                            "id": f"XFER-IN-{xfer['id']}",
                            "type": "Transfer In (from BPI Sales)",
                            "reference": ref_code,
                            "date": xfer["tx_date"],
                            "amount": x_amt,
                            "direction": "IN",
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
    """Transfers collected funds between banks via JournalEntry without touching APInvoice or ARInvoice."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than 0")
    if payload.fromBankID == payload.toBankID:
        raise HTTPException(status_code=400, detail="Source and destination banks must be different")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            b_table = get_exact_table_name(cur, "BankAccount") or "BankAccount"
            b_cols = get_exact_cols(cur, b_table)
            b_pk = b_cols.get("bankaccountid", "bankAccountID")
            b_name = b_cols.get("bankname", "bankName")

            cur.execute(f'SELECT "{b_name}" AS name FROM "{b_table}" WHERE "{b_pk}" = %s', (payload.fromBankID,))
            from_row = cur.fetchone()
            cur.execute(f'SELECT "{b_name}" AS name FROM "{b_table}" WHERE "{b_pk}" = %s', (payload.toBankID,))
            to_row = cur.fetchone()

            if not from_row or not to_row:
                raise HTTPException(status_code=404, detail="Source or destination bank account not found")

            je_t = get_exact_table_name(cur, "JournalEntry")
            jel_t = get_exact_table_name(cur, "JournalEntryLine")
            coa_t = get_exact_table_name(cur, "ChartOfAccounts")

            if not (je_t and jel_t and coa_t):
                raise HTTPException(status_code=500, detail="Journal tables not found")

            c_cols = get_exact_cols(cur, coa_t)
            c_id = c_cols.get("accountid", "accountID")
            c_code = c_cols.get("accountcode", "accountCode")
            c_name = c_cols.get("accountname", "accountName")

            cur.execute(f"""
                SELECT "{c_id}" AS id FROM "{coa_t}"
                WHERE "{c_code}" IN ('1020', '1010')
                   OR "{c_name}" ILIKE '%Bank%'
                   OR "{c_name}" ILIKE '%Cash%'
                ORDER BY "{c_code}" ASC LIMIT 1
            """)
            cash_acc = cur.fetchone()
            if not cash_acc:
                raise HTTPException(status_code=400, detail="Cash in Bank account not found in ChartOfAccounts")

            desc_text = (
                f"Bank Transfer: {from_row['name']} -> {to_row['name']} "
                f"[FROM:{payload.fromBankID}|TO:{payload.toBankID}]"
            )

            cur.execute(f"""
                INSERT INTO "{je_t}" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
                VALUES (%s, 'XFER-AUTO', 'Cash Transfer', %s, %s)
                RETURNING "journalID"
            """, (payload.transferDate, desc_text, payload.fromBankID))
            jid = cur.fetchone()["journalID"]

            cur.execute(
                f'UPDATE "{je_t}" SET "referenceNo" = %s WHERE "journalID" = %s',
                (f"XFER-{str(jid).zfill(4)}", jid)
            )
            cur.execute(
                f'INSERT INTO "{jel_t}" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)',
                (jid, cash_acc["id"], payload.amount)
            )
            cur.execute(
                f'INSERT INTO "{jel_t}" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)',
                (jid, cash_acc["id"], payload.amount)
            )

            conn.commit()
            return {"message": f"Transferred {payload.amount:,.2f} from {from_row['name']} to {to_row['name']}"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()