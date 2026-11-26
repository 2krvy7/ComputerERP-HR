from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/payments",
    tags=["AP Payments"]
)

class NewPaymentPayload(BaseModel):
    apInvoiceID: int
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
def get_payments():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pay_t = get_exact_table_name(cur, "APPayment")
            if not pay_t:
                return []

            p_cols = get_exact_cols(cur, pay_t)
            p_pk = p_cols.get("paymentid", "paymentID")
            p_inv = p_cols.get("apinvoiceid", "apInvoiceID")
            p_bank = p_cols.get("bankaccountid", "bankAccountID")
            p_date = p_cols.get("paymentdate", "paymentDate")
            p_amt = p_cols.get("amount", "amount")

            inv_t = get_exact_table_name(cur, "APInvoice")
            bank_t = get_exact_table_name(cur, "BankAccount")
            sup_t = get_exact_table_name(cur, "Supplier")

            inv_join = ""
            sup_join = ""
            sup_select = "NULL AS supplier_name"
            if inv_t:
                i_cols = get_exact_cols(cur, inv_t)
                i_pk = i_cols.get("apinvoiceid", "apInvoiceID")
                i_sup = i_cols.get("supplierid", "supplierID")
                inv_join = f'LEFT JOIN "{inv_t}" i ON p."{p_inv}" = i."{i_pk}"'
                if sup_t and i_sup:
                    s_cols = get_exact_cols(cur, sup_t)
                    s_pk = s_cols.get("supplierid") or s_cols.get("id")
                    s_name = next((orig for low, orig in s_cols.items() if "name" in low), None)
                    if s_pk and s_name:
                        sup_join = f'LEFT JOIN "{sup_t}" s ON i."{i_sup}" = s."{s_pk}"'
                        sup_select = f's."{s_name}" AS supplier_name'

            bank_join = ""
            bank_select = "NULL AS bank_name, NULL AS account_number"
            if bank_t:
                b_cols = get_exact_cols(cur, bank_t)
                b_pk = b_cols.get("bankaccountid", "bankAccountID")
                b_name = b_cols.get("bankname", "bankName")
                b_num = b_cols.get("accountnumber", "accountNumber")
                bank_join = f'LEFT JOIN "{bank_t}" b ON p."{p_bank}" = b."{b_pk}"'
                bank_select = f'b."{b_name}" AS bank_name, b."{b_num}" AS account_number'

            cur.execute(f"""
                SELECT 
                    p."{p_pk}" AS "paymentID",
                    p."{p_inv}" AS "apInvoiceID",
                    p."{p_bank}" AS "bankAccountID",
                    p."{p_date}" AS "paymentDate",
                    p."{p_amt}" AS "amount",
                    {sup_select},
                    {bank_select}
                FROM "{pay_t}" p
                {inv_join}
                {sup_join}
                {bank_join}
                ORDER BY p."{p_pk}" DESC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/options")
def get_payment_options():
    """Fetches open APInvoices and BankAccounts for the Record Payment modal."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            open_invoices = []
            inv_t = get_exact_table_name(cur, "APInvoice")
            sup_t = get_exact_table_name(cur, "Supplier")

            if inv_t:
                i_cols = get_exact_cols(cur, inv_t)
                i_pk = i_cols.get("apinvoiceid", "apInvoiceID")
                i_sup = i_cols.get("supplierid", "supplierID")
                i_amt = i_cols.get("amount", "amount")
                i_rem = i_cols.get("remainingbalance", "remainingBalance")
                i_stat = i_cols.get("status", "status")
                i_due = i_cols.get("duedate", "dueDate")

                sup_join = ""
                sup_select = "NULL AS supplier_name"
                if sup_t and i_sup:
                    s_cols = get_exact_cols(cur, sup_t)
                    s_pk = s_cols.get("supplierid") or s_cols.get("id")
                    s_name = next((orig for low, orig in s_cols.items() if "name" in low), None)
                    if s_pk and s_name:
                        sup_join = f'LEFT JOIN "{sup_t}" s ON i."{i_sup}" = s."{s_pk}"'
                        sup_select = f's."{s_name}" AS supplier_name'

                cur.execute(f"""
                    SELECT 
                        i."{i_pk}" AS "apInvoiceID",
                        i."{i_sup}" AS "supplierID",
                        i."{i_amt}" AS "amount",
                        COALESCE(i."{i_rem}", i."{i_amt}") AS "remainingBalance",
                        i."{i_stat}" AS "status",
                        i."{i_due}" AS "dueDate",
                        {sup_select}
                    FROM "{inv_t}" i
                    {sup_join}
                    WHERE COALESCE(i."{i_rem}", i."{i_amt}") > 0
                      AND LOWER(COALESCE(i."{i_stat}", 'unpaid')) != 'paid'
                    ORDER BY i."{i_pk}" ASC
                """)
                open_invoices = cur.fetchall()

            bank_accounts = []
            bank_t = get_exact_table_name(cur, "BankAccount")
            if bank_t:
                b_cols = get_exact_cols(cur, bank_t)
                b_pk = b_cols.get("bankaccountid", "bankAccountID")
                b_name = b_cols.get("bankname", "bankName")
                b_num = b_cols.get("accountnumber", "accountNumber")
                b_disb = b_cols.get("isdisbursement")

                where_disb = (
                    f'WHERE COALESCE("{b_disb}", TRUE) = TRUE'
                    if b_disb
                    else ""
                )

                cur.execute(f"""
                    SELECT 
                        "{b_pk}" AS "bankAccountID",
                        "{b_name}" AS "bankName",
                        "{b_num}" AS "accountNumber",
                        {f'COALESCE("{b_disb}", TRUE)' if b_disb else 'TRUE'} AS "isDisbursement"
                    FROM "{bank_t}"
                    {where_disb}
                    ORDER BY "{b_pk}" ASC
                """)
                bank_accounts = cur.fetchall()

            return {
                "openInvoices": open_invoices,
                "bankAccounts": bank_accounts,
            }
    finally:
        conn.close()

@router.post("/")
def create_payment(payload: NewPaymentPayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pay_t = get_exact_table_name(cur, "APPayment") or "APPayment"
            inv_t = get_exact_table_name(cur, "APInvoice") or "APInvoice"
            p_cols = get_exact_cols(cur, pay_t)
            i_cols = get_exact_cols(cur, inv_t)

            # 1. Insert into APPayment
            cur.execute(f"""
                INSERT INTO "{pay_t}" (
                    "{p_cols.get('apinvoiceid', 'apInvoiceID')}",
                    "{p_cols.get('bankaccountid', 'bankAccountID')}",
                    "{p_cols.get('paymentdate', 'paymentDate')}",
                    "{p_cols.get('amount', 'amount')}"
                )
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (
                payload.apInvoiceID,
                payload.bankAccountID,
                payload.paymentDate,
                payload.amount,
            ))
            created = cur.fetchone()

            # 2. Update APInvoice totalPaid, remainingBalance, and status
            pk_col = i_cols.get("apinvoiceid", "apInvoiceID")
            paid_col = i_cols.get("totalpaid", "totalPaid")
            rem_col = i_cols.get("remainingbalance", "remainingBalance")
            amt_col = i_cols.get("amount", "amount")
            stat_col = i_cols.get("status", "status")

            cur.execute(f"""
                UPDATE "{inv_t}"
                SET "{paid_col}" = COALESCE("{paid_col}", 0) + %s,
                    "{rem_col}" = GREATEST(COALESCE("{rem_col}", "{amt_col}") - %s, 0),
                    "{stat_col}" = CASE
                        WHEN COALESCE("{rem_col}", "{amt_col}") - %s <= 0 THEN 'Paid'
                        ELSE 'Partial'
                    END
                WHERE "{pk_col}" = %s
                RETURNING *
            """, (payload.amount, payload.amount, payload.amount, payload.apInvoiceID))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="AP Invoice not found")

                        # 3. Automatically post to JournalEntry, JournalEntryLine & GeneralLedger
            payment_id = created.get("paymentID") or created.get("paymentid")
            cur.execute('SELECT "accountID" FROM "ChartOfAccounts" WHERE "accountCode" = \'2010\' LIMIT 1')
            ap_acc = cur.fetchone()
            cur.execute('SELECT "accountID" FROM "ChartOfAccounts" WHERE "accountCode" = \'1020\' LIMIT 1')
            cash_acc = cur.fetchone()

            if ap_acc and cash_acc:
                cur.execute("""
                    INSERT INTO "JournalEntry" (
                        "journalDate", "referenceNo", "sourceModule", "description", "sourceID"
                    )
                    VALUES (%s, %s, 'AP Payment', %s, %s)
                    RETURNING "journalID"
                """, (
                    payload.paymentDate,
                    f"PAY-{str(payment_id).zfill(4)}",
                    f"Supplier payment for AP Bill #{payload.apInvoiceID}",
                    payment_id,
                ))
                journal_id = cur.fetchone()["journalID"]

                # Debit Accounts Payable (2010)
                cur.execute("""
                    INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit")
                    VALUES (%s, %s, %s, 0)
                """, (journal_id, ap_acc["accountID"], payload.amount))

                cur.execute("""
                    INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance")
                    VALUES (%s, %s, %s, 0, %s)
                """, (ap_acc["accountID"], journal_id, payload.amount, -payload.amount))

                # Credit Cash in Bank (1020)
                cur.execute("""
                    INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit")
                    VALUES (%s, %s, 0, %s)
                """, (journal_id, cash_acc["accountID"], payload.amount))

                cur.execute("""
                    INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance")
                    VALUES (%s, %s, 0, %s, %s)
                """, (cash_acc["accountID"], journal_id, payload.amount, -payload.amount))


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
