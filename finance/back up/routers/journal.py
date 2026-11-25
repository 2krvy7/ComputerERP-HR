from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/journal",
    tags=["Journal"]
)

@router.get("/")
def get_journal_entries():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
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