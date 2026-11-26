from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"]
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

def fetch_account_balances(cur) -> list[dict]:
    """Aggregates GeneralLedger debit and credit totals per ChartOfAccounts entry, syncing real unpaid AR."""
    coa_table = get_exact_table_name(cur, "ChartOfAccounts")
    if not coa_table:
        return []

    c_cols = get_exact_cols(cur, coa_table)
    c_id = c_cols.get("accountid", "accountID")
    c_code = c_cols.get("accountcode", "accountCode")
    c_name = c_cols.get("accountname", "accountName")
    c_type = c_cols.get("accounttype", "accountType")

    # Calculate true unpaid Accounts Receivable from ARInvoice (excluding seed row 1 and Paid rows)
    true_unpaid_ar = 0.0
    ar_table = get_exact_table_name(cur, "ARInvoice")
    if ar_table:
        a_cols = get_exact_cols(cur, ar_table)
        a_pk = a_cols.get("arinvoiceid", "arInvoiceID")
        a_amt = a_cols.get("amount", "amount")
        a_rem = a_cols.get("remainingbalance", "remainingBalance")
        a_stat = a_cols.get("status", "status")
        cur.execute(f"""
            SELECT COALESCE(SUM(COALESCE("{a_rem}", "{a_amt}")), 0) AS unpaid_ar
            FROM "{ar_table}"
            WHERE "{a_pk}" != 1
              AND COALESCE("{a_rem}", "{a_amt}") > 0
              AND LOWER(COALESCE("{a_stat}", 'open')) != 'paid'
        """)
        true_unpaid_ar = float(cur.fetchone()["unpaid_ar"] or 0)

    gl_table = get_exact_table_name(cur, "GeneralLedger")
    if not gl_table:
        cur.execute(f"""
            SELECT 
                "{c_id}" AS "accountID",
                "{c_code}" AS "accountCode",
                "{c_name}" AS "accountName",
                "{c_type}" AS "accountType"
            FROM "{coa_table}"
            ORDER BY "{c_code}" ASC
        """)
        results = []
        for r in cur.fetchall():
            code_str = str(r["accountCode"] or "")
            name_low = str(r["accountName"] or "").lower()
            is_ar = code_str == "1100" or "receivable" in name_low
            deb = true_unpaid_ar if is_ar else 0.0
            results.append({
                "accountID": r["accountID"],
                "accountCode": r["accountCode"],
                "accountName": r["accountName"],
                "accountType": (r["accountType"] or "").strip(),
                "totalDebit": deb,
                "totalCredit": 0.0,
                "netBalance": deb,
            })
        return results

    g_cols = get_exact_cols(cur, gl_table)
    g_acc = g_cols.get("accountid", "accountID")
    g_deb = g_cols.get("debitamount") or g_cols.get("debit") or "debitAmount"
    g_cred = g_cols.get("creditamount") or g_cols.get("credit") or "creditAmount"

    cur.execute(f"""
        SELECT 
            c."{c_id}" AS "accountID",
            c."{c_code}" AS "accountCode",
            c."{c_name}" AS "accountName",
            c."{c_type}" AS "accountType",
            COALESCE(SUM(g."{g_deb}"), 0) AS "totalDebit",
            COALESCE(SUM(g."{g_cred}"), 0) AS "totalCredit"
        FROM "{coa_table}" c
        LEFT JOIN "{gl_table}" g ON c."{c_id}" = g."{g_acc}"
        GROUP BY c."{c_id}", c."{c_code}", c."{c_name}", c."{c_type}"
        ORDER BY c."{c_code}" ASC
    """)
    rows = cur.fetchall()

    results = []
    for r in rows:
        code_str = str(r["accountCode"] or "")
        name_low = str(r["accountName"] or "").lower()
        acc_type = (r["accountType"] or "").strip()

        # Override Accounts Receivable with true unpaid ARInvoice balance so collected invoices show $0.00
        if code_str == "1100" or "receivable" in name_low:
            debit = true_unpaid_ar
            credit = 0.0
            net_balance = true_unpaid_ar
        else:
            debit = float(r["totalDebit"] or 0)
            credit = float(r["totalCredit"] or 0)
            is_debit_normal = acc_type.lower() in ("asset", "expense")
            net_balance = (debit - credit) if is_debit_normal else (credit - debit)

        results.append({
            "accountID": r["accountID"],
            "accountCode": r["accountCode"],
            "accountName": r["accountName"],
            "accountType": acc_type,
            "totalDebit": debit,
            "totalCredit": credit,
            "netBalance": net_balance,
        })
    return results

@router.get("/trial-balance")
def trial_balance():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            accounts = fetch_account_balances(cur)
            total_debits = sum(a["totalDebit"] for a in accounts)
            total_credits = sum(a["totalCredit"] for a in accounts)

            return {
                "report": "Trial Balance",
                "accounts": accounts,
                "totalDebits": total_debits,
                "totalCredits": total_credits,
                "isBalanced": round(total_debits, 2) == round(total_credits, 2),
            }
    finally:
        conn.close()


@router.get("/income-statement")
def income_statement():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            accounts = fetch_account_balances(cur)
            revenues = [a for a in accounts if a["accountType"].lower() == "revenue"]
            expenses = [a for a in accounts if a["accountType"].lower() == "expense"]

            total_revenue = sum(a["netBalance"] for a in revenues)
            total_expense = sum(a["netBalance"] for a in expenses)
            net_income = total_revenue - total_expense

            return {
                "report": "Income Statement",
                "revenues": revenues,
                "expenses": expenses,
                "totalRevenue": total_revenue,
                "totalExpense": total_expense,
                "netIncome": net_income,
            }
    finally:
        conn.close()

@router.get("/balance-sheet")
def balance_sheet():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            accounts = fetch_account_balances(cur)
            assets = [a for a in accounts if a["accountType"].lower() == "asset"]
            liabilities = [a for a in accounts if a["accountType"].lower() == "liability"]
            equity = [a for a in accounts if a["accountType"].lower() == "equity"]

            revenues = [a for a in accounts if a["accountType"].lower() == "revenue"]
            expenses = [a for a in accounts if a["accountType"].lower() == "expense"]
            net_income = sum(a["netBalance"] for a in revenues) - sum(a["netBalance"] for a in expenses)

            total_assets = sum(a["netBalance"] for a in assets)
            total_liabilities = sum(a["netBalance"] for a in liabilities)
            total_equity = sum(a["netBalance"] for a in equity) + net_income

            return {
                "report": "Balance Sheet",
                "assets": assets,
                "liabilities": liabilities,
                "equity": equity,
                "netIncome": net_income,
                "totalAssets": total_assets,
                "totalLiabilities": total_liabilities,
                "totalEquity": total_equity,
                "totalLiabilitiesAndEquity": total_liabilities + total_equity,
                "isBalanced": round(total_assets, 2) == round(total_liabilities + total_equity, 2),
            }
    finally:
        conn.close()

@router.get("/cash-flow")
def cash_flow():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            inflows = 0.0
            outflows = 0.0

            rec_table = get_exact_table_name(cur, "ARReceipt")
            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                amt_col = r_cols.get("amount", "amount")
                cur.execute(f'SELECT COALESCE(SUM("{amt_col}"), 0) AS s FROM "{rec_table}"')
                inflows = float(cur.fetchone()["s"])

            pay_table = get_exact_table_name(cur, "APPayment")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                amt_col = p_cols.get("amount", "amount")
                cur.execute(f'SELECT COALESCE(SUM("{amt_col}"), 0) AS s FROM "{pay_table}"')
                outflows += float(cur.fetchone()["s"])

            # Include approved HR Payroll and Direct Operating Expenses from JournalEntry
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            if je_table and jel_table:
                cur.execute(f"""
                    SELECT COALESCE(SUM(l."debit"), 0) AS s
                    FROM "{je_table}" j
                    JOIN "{jel_table}" l ON j."journalID" = l."journalID"
                    WHERE j."sourceModule" IN ('Payroll', 'Expenses')
                      AND COALESCE(l."debit", 0) > 0
                """)
                outflows += float(cur.fetchone()["s"] or 0)

            net_cash_flow = inflows - outflows

            return {
                "report": "Cash Flow",
                "operatingInflows": inflows,
                "operatingOutflows": outflows,
                "netOperatingCashFlow": net_cash_flow,
                "endingCashBalance": net_cash_flow,
            }
    finally:
        conn.close()

def calculate_aging(cur, invoice_table: str, pk_key: str, party_key: str, party_table: str | None) -> dict:
    inv_t = get_exact_table_name(cur, invoice_table)
    empty_summary = {
        "current": 0.0,
        "days1to30": 0.0,
        "days31to60": 0.0,
        "days61to90": 0.0,
        "days90plus": 0.0,
        "total": 0.0,
    }
    if not inv_t:
        return {"items": [], "summary": empty_summary}

    i_cols = get_exact_cols(cur, inv_t)
    pk_col = i_cols.get(pk_key, pk_key)
    party_col = i_cols.get(party_key, party_key)
    amt_col = i_cols.get("amount", "amount")
    rem_col = i_cols.get("remainingbalance", "remainingBalance")
    due_col = i_cols.get("duedate", "dueDate")
    stat_col = i_cols.get("status", "status")

    join_sql = ""
    select_party = f'CAST(i."{party_col}" AS TEXT) AS party_name'
    if party_table:
        p_t = get_exact_table_name(cur, party_table)
        if p_t:
            p_cols = get_exact_cols(cur, p_t)
            p_pk = p_cols.get(party_key) or p_cols.get("id")
            p_name = next((orig for low, orig in p_cols.items() if "name" in low), None)
            if p_pk and p_name:
                join_sql = f'LEFT JOIN "{p_t}" p ON i."{party_col}" = p."{p_pk}"'
                select_party = f'COALESCE(p."{p_name}", CAST(i."{party_col}" AS TEXT)) AS party_name'

    seed_filter = f'AND i."{pk_col}" != 1' if pk_key == "arinvoiceid" else ""

    cur.execute(f"""
        SELECT 
            i."{pk_col}" AS id,
            {select_party},
            i."{due_col}" AS due_date,
            COALESCE(i."{rem_col}", i."{amt_col}") AS balance,
            GREATEST((CURRENT_DATE - COALESCE(CAST(i."{due_col}" AS DATE), CURRENT_DATE)), 0) AS days_overdue
        FROM "{inv_t}" i
        {join_sql}
        WHERE COALESCE(i."{rem_col}", i."{amt_col}") > 0
          AND LOWER(COALESCE(i."{stat_col}", 'open')) != 'paid'
          {seed_filter}
        ORDER BY i."{due_col}" ASC NULLS LAST
    """)
    rows = cur.fetchall()

    summary = dict(empty_summary)
    items = []

    for r in rows:
        bal = float(r["balance"] or 0)
        days = int(r["days_overdue"] or 0)

        if days <= 0:
            bucket = "Current"
            summary["current"] += bal
        elif days <= 30:
            bucket = "1-30 Days"
            summary["days1to30"] += bal
        elif days <= 60:
            bucket = "31-60 Days"
            summary["days31to60"] += bal
        elif days <= 90:
            bucket = "61-90 Days"
            summary["days61to90"] += bal
        else:
            bucket = "90+ Days"
            summary["days90plus"] += bal

        summary["total"] += bal
        items.append({
            "id": r["id"],
            "partyName": r["party_name"],
            "dueDate": r["due_date"],
            "balance": bal,
            "daysOverdue": days,
            "bucket": bucket,
        })

    return {"items": items, "summary": summary}

@router.get("/ar-aging")
def ar_aging():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            data = calculate_aging(cur, "ARInvoice", "arinvoiceid", "customerid", "Customer")
            return {"report": "AR Aging", **data}
    finally:
        conn.close()

@router.get("/ap-aging")
def ap_aging():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            data = calculate_aging(cur, "APInvoice", "apinvoiceid", "supplierid", "Supplier")
            return {"report": "AP Aging", **data}
    finally:
        conn.close()
