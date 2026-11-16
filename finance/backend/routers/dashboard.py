from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

@router.get("/")
def get_dashboard_summary():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # 1. Recent Journal Entries (Top 5)
            # Adjust column names if your JournalEntry table uses different casing
            cur.execute("""
                SELECT *
                FROM "JournalEntry"
                ORDER BY 1 DESC
                LIMIT 5
            """)
            recent_entries = cur.fetchall()

            # 2. Accounts Payable summary (from your PurchaseInvoice table)
            cur.execute("""
                SELECT 
                    COUNT(*) AS outstanding_count,
                    COALESCE(SUM("TotalDue"), 0) AS total_due
                FROM "PurchaseInvoice"
            """)
            ap_summary = cur.fetchone()

            # 3. Chart of Accounts balances (Assets, Liabilities, Revenue, Expenses)
            # Note: Replace "balance" and "accountType" with your exact ChartOfAccounts column names
            cur.execute("""
                SELECT * FROM "ChartOfAccounts"
            """)
            accounts = cur.fetchall()

            return {
                "summary": {
                    "totalAssets": 0,
                    "totalLiabilities": 0,
                    "cashBalance": 0,
                    "netIncome": 0,
                },
                "accounts": accounts,
                "recentEntries": recent_entries,
                "ap": {
                    "outstandingInvoices": ap_summary["outstanding_count"],
                    "totalDue": float(ap_summary["total_due"]),
                    "dueThisWeek": 0,
                },
                "ar": {
                    "outstandingInvoices": 0,
                    "totalReceivable": 0,
                    "pastDue": 0,
                },
            }
    finally:
        conn.close()