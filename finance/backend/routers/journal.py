from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/journal",
    tags=["Journal"]
)

class JournalLinePayload(BaseModel):
    accountID: int
    debit: float = 0
    credit: float = 0

class NewJournalPayload(BaseModel):
    journalDate: str
    referenceNo: str | None = None
    sourceModule: str = "Manual"
    description: str
    lines: list[JournalLinePayload]


def auto_sync_journal_entries(cur):
    """
    Automatically collects all unposted AP Payments, AR Receipts, and Direct Expenses
    and posts balanced double-entry lines into JournalEntry, JournalEntryLine, and GeneralLedger.
    """
    # 1. Auto-detect core Chart of Accounts IDs safely
    cur.execute("""
        SELECT "accountID" FROM "ChartOfAccounts"
        WHERE "accountCode" IN ('1020', '1010')
           OR "accountName" ILIKE '%Bank%'
           OR "accountName" ILIKE '%Cash%'
           OR LOWER("accountType") = 'asset'
        ORDER BY CASE WHEN "accountName" ILIKE '%Bank%' THEN 1 ELSE 2 END, "accountCode" ASC
        LIMIT 1
    """)
    cash_row = cur.fetchone()

    cur.execute("""
        SELECT "accountID" FROM "ChartOfAccounts"
        WHERE "accountCode" IN ('2010', '2000')
           OR "accountName" ILIKE '%Payable%'
           OR LOWER("accountType") = 'liability'
        ORDER BY CASE WHEN "accountName" ILIKE '%Payable%' THEN 1 ELSE 2 END, "accountCode" ASC
        LIMIT 1
    """)
    ap_row = cur.fetchone()

    cur.execute("""
        SELECT "accountID" FROM "ChartOfAccounts"
        WHERE "accountCode" IN ('1100', '1200')
           OR "accountName" ILIKE '%Receivable%'
        ORDER BY "accountCode" ASC
        LIMIT 1
    """)
    ar_row = cur.fetchone()

    cash_id = cash_row["accountID"] if cash_row else None
    ap_id = ap_row["accountID"] if ap_row else None
    ar_id = ar_row["accountID"] if ar_row else cash_id

    if not cash_id:
        return

    # 2. Auto-post all unposted AP Payments (Debit Accounts Payable, Credit Cash in Bank)
    if ap_id:
        cur.execute("""
            SELECT p."paymentID", p."apInvoiceID", p."paymentDate", p."amount"
            FROM "APPayment" p
            WHERE COALESCE(p."amount", 0) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM "JournalEntry" j
                  WHERE j."sourceModule" = 'AP Payment' AND j."sourceID" = p."paymentID"
              )
            ORDER BY p."paymentID" ASC
        """)
        for pay in cur.fetchall():
            pid = pay["paymentID"]
            amt = float(pay["amount"])
            ref = f"PAY-{str(pid).zfill(4)}"
            cur.execute("""
                INSERT INTO "JournalEntry" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
                VALUES (%s, %s, 'AP Payment', %s, %s)
                RETURNING "journalID"
            """, (pay["paymentDate"], ref, f"Supplier payment for AP Bill #{pay['apInvoiceID']}", pid))
            jid = cur.fetchone()["journalID"]

            cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, ap_id, amt))
            cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, cash_id, amt))
            cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (ap_id, jid, amt, -amt))
            cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (cash_id, jid, amt, -amt))

    # 3. Auto-post all unposted AR Receipts (excluding seed arInvoiceID = 1)
    if ar_id:
        cur.execute("""
            SELECT r."receiptID", r."arInvoiceID", r."paymentDate", r."amount"
            FROM "ARReceipt" r
            WHERE COALESCE(r."amount", 0) > 0
              AND r."arInvoiceID" != 1
              AND NOT EXISTS (
                  SELECT 1 FROM "JournalEntry" j
                  WHERE j."sourceModule" = 'AR Collection' AND j."sourceID" = r."receiptID"
              )
            ORDER BY r."receiptID" ASC
        """)
        for rec in cur.fetchall():
            rid = rec["receiptID"]
            amt = float(rec["amount"])
            ref = f"REC-{str(rid).zfill(4)}"
            cur.execute("""
                INSERT INTO "JournalEntry" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
                VALUES (%s, %s, 'AR Collection', %s, %s)
                RETURNING "journalID"
            """, (rec["paymentDate"], ref, f"Customer collection for AR Invoice #{rec['arInvoiceID']}", rid))
            jid = cur.fetchone()["journalID"]

            cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, cash_id, amt))
            cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, ar_id, amt))
            cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (cash_id, jid, amt, amt))
            cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (ar_id, jid, amt, -amt))

    # 4. Auto-post any unposted Direct Expenses (where postingID IS NULL and productionID IS NULL)
    cur.execute("""
        SELECT e."expenseID", e."accountID", e."amount"
        FROM "Expense" e
        WHERE e."postingID" IS NULL
          AND e."productionID" IS NULL
          AND COALESCE(e."amount", 0) > 0
    """)
    for exp in cur.fetchall():
        eid = exp["expenseID"]
        amt = float(exp["amount"])
        ref = f"EXP-{str(eid).zfill(4)}"
        cur.execute("""
            INSERT INTO "JournalEntry" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
            VALUES (CURRENT_DATE, %s, 'Expenses', %s, %s)
            RETURNING "journalID"
        """, (ref, f"Operating Expense #{eid}", eid))
        jid = cur.fetchone()["journalID"]

        cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, exp["accountID"], amt))
        cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, cash_id, amt))
        cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (exp["accountID"], jid, amt, amt))
        cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (cash_id, jid, amt, -amt))
        cur.execute('UPDATE "Expense" SET "postingID" = %s WHERE "expenseID" = %s', (jid, eid))

@router.get("/")
def get_journal_entries():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # Automatically collect and post all unposted AP Payments, AR Receipts & Direct Expenses
            auto_sync_journal_entries(cur)
            conn.commit()

            cur.execute("""
                SELECT 
                    j."journalID",
                    j."journalDate",
                    j."referenceNo",
                    j."sourceModule",
                    j."description",
                    j."sourceID",
                    COALESCE(SUM(l."debit"), 0) AS total_debit,
                    COALESCE(SUM(l."credit"), 0) AS total_credit
                FROM "JournalEntry" j
                LEFT JOIN "JournalEntryLine" l ON j."journalID" = l."journalID"
                GROUP BY j."journalID", j."journalDate", j."referenceNo", j."sourceModule", j."description", j."sourceID"
                ORDER BY j."journalID" DESC
            """)
            entries = cur.fetchall()

            results = []
            for e in entries:
                jid = e["journalID"]
                cur.execute("""
                    SELECT 
                        l."lineID",
                        l."accountID",
                        c."accountCode",
                        c."accountName",
                        l."debit",
                        l."credit"
                    FROM "JournalEntryLine" l
                    LEFT JOIN "ChartOfAccounts" c ON l."accountID" = c."accountID"
                    WHERE l."journalID" = %s
                    ORDER BY l."lineID" ASC
                """, (jid,))
                lines = cur.fetchall()

                ref = e["referenceNo"] or f"JE-{str(jid).zfill(4)}"
                results.append({
                    "id": jid,
                    "journalID": jid,
                    "entryNumber": ref,
                    "referenceNo": ref,
                    "journalDate": e["journalDate"],
                    "sourceModule": e["sourceModule"] or "Manual",
                    "description": e["description"] or "",
                    "sourceID": e["sourceID"],
                    "totalDebit": float(e["total_debit"] or 0),
                    "totalCredit": float(e["total_credit"] or 0),
                    "status": "Posted",
                    "lines": lines,
                })
            return results
    finally:
        conn.close()


@router.post("/")
def create_journal_entry(payload: NewJournalPayload):
    total_debit = sum(float(l.debit or 0) for l in payload.lines)
    total_credit = sum(float(l.credit or 0) for l in payload.lines)

    if total_debit <= 0 or abs(total_debit - total_credit) > 0.01:
        raise HTTPException(status_code=400, detail="Journal entry must be balanced and greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                INSERT INTO "JournalEntry" ("journalDate", "referenceNo", "sourceModule", "description")
                VALUES (%s, %s, %s, %s)
                RETURNING "journalID"
            """, (payload.journalDate, payload.referenceNo or "JE-MANUAL", payload.sourceModule, payload.description))
            jid = cur.fetchone()["journalID"]

            if not payload.referenceNo:
                cur.execute('UPDATE "JournalEntry" SET "referenceNo" = %s WHERE "journalID" = %s', (f"JE-{str(jid).zfill(4)}", jid))

            for line in payload.lines:
                d = float(line.debit or 0)
                c = float(line.credit or 0)
                if d == 0 and c == 0:
                    continue
                cur.execute("""
                    INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit")
                    VALUES (%s, %s, %s, %s)
                """, (jid, line.accountID, d, c))

                cur.execute("""
                    INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance")
                    VALUES (%s, %s, %s, %s, %s)
                """, (line.accountID, jid, d, c, d - c))

            conn.commit()
            return {"journalID": jid, "status": "Posted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
