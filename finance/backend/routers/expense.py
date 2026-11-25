from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/expense",
    tags=["Expenses"]
)

class NewExpensePayload(BaseModel):
    accountID: int
    productionID: int | None = None
    description: str = ""
    amount: float

class ProductionCostRequest(BaseModel):
    productionID: int
    productID: int
    quantity: float
    totalCost: float
    accountID: int

class PayrollRequestPayload(BaseModel):
    payroll_id: int
    amount: float

class PayPayrollPayload(BaseModel):
    payrollExpenseID: int
    bankAccountID: int
    paymentDate: str

class BatchApproveExpensesPayload(BaseModel):
    expenseIds: list[int] = []
    payrollIds: list[int] = []
    productionOrderIds: list[int] = []
    approvalDate: str | None = None



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

def auto_sync_external_expenses(cur):
    """Automatically pulls completed Production batches & finalized HR Payroll runs from shared DB."""
    coa_t = get_exact_table_name(cur, "ChartOfAccounts")
    default_prod_acc = None
    if coa_t:
        c_cols = get_exact_cols(cur, coa_t)
        c_id = c_cols.get("accountid", "accountID")
        c_code = c_cols.get("accountcode", "accountCode")
        c_name = c_cols.get("accountname", "accountName")
        c_type = c_cols.get("accounttype", "accountType")
        cur.execute(f"""
            SELECT "{c_id}" AS id FROM "{coa_t}"
            WHERE "{c_code}" IN ('5010', '5000')
               OR "{c_name}" ILIKE '%Production%'
               OR "{c_name}" ILIKE '%Cost of Goods%'
               OR LOWER("{c_type}") = 'expense'
            ORDER BY
                CASE WHEN "{c_name}" ILIKE '%Production%' THEN 1
                     WHEN "{c_name}" ILIKE '%Cost of Goods%' THEN 2
                     ELSE 3 END,
                "{c_code}" ASC
            LIMIT 1
        """)
        acc_row = cur.fetchone()
        if acc_row:
            default_prod_acc = acc_row["id"]

    # Auto-sync Team 3 PRODUCTION -> Finance ProductionOrder & Expense
    src_prod_t = get_exact_table_name(cur, "PRODUCTION") or get_exact_table_name(cur, "Production")
    fin_prod_t = get_exact_table_name(cur, "ProductionOrder")
    fin_exp_t = get_exact_table_name(cur, "Expense")

    if fin_prod_t:
        fp_cols = get_exact_cols(cur, fin_prod_t)
        fp_pk = fp_cols.get("productionid") or fp_cols.get("production_id") or fp_cols.get("id")
        fp_prod = fp_cols.get("productid") or fp_cols.get("product_id")
        fp_qty = fp_cols.get("quantity") or fp_cols.get("qty")
        # Dynamically find whichever cost column exists on ProductionOrder
        fp_cost = (
            fp_cols.get("totalcost")
            or fp_cols.get("total_cost")
            or fp_cols.get("cost")
            or fp_cols.get("amount")
        )

        if src_prod_t and fp_pk and fp_qty and fp_cost:
            sp_cols = get_exact_cols(cur, src_prod_t)
            sp_pk = sp_cols.get("production_id") or sp_cols.get("productionid") or sp_cols.get("id")
            sp_pm = sp_cols.get("pm_id") or sp_cols.get("product_id") or sp_cols.get("productid")
            sp_qty = sp_cols.get("quantityproduced") or sp_cols.get("quantity_produced") or sp_cols.get("quantity")
            sp_unit = sp_cols.get("unitproductioncost") or sp_cols.get("unit_production_cost") or sp_cols.get("unitcost")
            sp_tot = sp_cols.get("totalcost") or sp_cols.get("total_cost")
            sp_stat = sp_cols.get("status")

            if sp_pk and sp_qty and (sp_tot or sp_unit):
                cost_expr = f'p."{sp_tot}"' if sp_tot else f'(COALESCE(p."{sp_qty}", 0) * COALESCE(p."{sp_unit}", 0))'
                stat_filter = f'AND LOWER(COALESCE(p."{sp_stat}", \'completed\')) IN (\'completed\', \'done\', \'finished\')' if sp_stat else ""

                ins_cols = [f'"{fp_pk}"', f'"{fp_qty}"', f'"{fp_cost}"']
                sel_cols = [f'p."{sp_pk}"', f'p."{sp_qty}"', cost_expr]
                if fp_prod and sp_pm:
                    ins_cols.append(f'"{fp_prod}"')
                    sel_cols.append(f'p."{sp_pm}"')

                cur.execute(f"""
                    INSERT INTO "{fin_prod_t}" ({", ".join(ins_cols)})
                    SELECT {", ".join(sel_cols)}
                    FROM "{src_prod_t}" p
                    WHERE {cost_expr} > 0
                      {stat_filter}
                      AND NOT EXISTS (
                          SELECT 1 FROM "{fin_prod_t}" fp WHERE fp."{fp_pk}" = p."{sp_pk}"
                      )
                """)

        if fin_exp_t and default_prod_acc and fp_pk and fp_cost:
            fe_cols = get_exact_cols(cur, fin_exp_t)
            fe_acc = fe_cols.get("accountid", "accountID")
            fe_prod = fe_cols.get("productionid", "productionID")
            fe_amt = fe_cols.get("amount", "amount")

            cur.execute(f"""
                INSERT INTO "{fin_exp_t}" ("{fe_acc}", "{fe_prod}", "{fe_amt}")
                SELECT %s, fp."{fp_pk}", fp."{fp_cost}"
                FROM "{fin_prod_t}" fp
                WHERE COALESCE(fp."{fp_cost}", 0) > 0
                  AND NOT EXISTS (
                      SELECT 1 FROM "{fin_exp_t}" fe WHERE fe."{fe_prod}" = fp."{fp_pk}"
                  )
            """, (default_prod_acc,))

    # Auto-sync Team 6 Payroll -> Finance PayrollExpense
    hr_t = (
        get_exact_table_name(cur, "Payroll")
        or get_exact_table_name(cur, "Payrolls")
        or get_exact_table_name(cur, "PayrollRun")
        or get_exact_table_name(cur, "Payroll_Run")
    )
    fin_pay_t = get_exact_table_name(cur, "PayrollExpense")

    if hr_t and fin_pay_t:
        h_cols = get_exact_cols(cur, hr_t)
        fp_cols = get_exact_cols(cur, fin_pay_t)

        h_pk = h_cols.get("payroll_id") or h_cols.get("payrollid") or h_cols.get("id")
        h_amt = (
            h_cols.get("total_amount")
            or h_cols.get("totalamount")
            or h_cols.get("net_pay")
            or h_cols.get("netpay")
            or h_cols.get("gross_pay")
            or h_cols.get("amount")
        )
        fp_pid = fp_cols.get("payroll_id", "payroll_id")
        fp_amt = fp_cols.get("amount", "amount")

        if h_pk and h_amt:
            cur.execute(f"""
                INSERT INTO "{fin_pay_t}" ("{fp_pid}", "{fp_amt}")
                SELECT h."{h_pk}", h."{h_amt}"
                FROM "{hr_t}" h
                WHERE COALESCE(h."{h_amt}", 0) > 0
                  AND NOT EXISTS (
                      SELECT 1 FROM "{fin_pay_t}" pe WHERE pe."{fp_pid}" = h."{h_pk}"
                  )
            """)


@router.get("/")
def get_expenses():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # Protect external auto-sync with a SAVEPOINT so GET /api/expense/ never crashes
            try:
                cur.execute("SAVEPOINT sync_ext_exp_sp")
                auto_sync_external_expenses(cur)
                cur.execute("RELEASE SAVEPOINT sync_ext_exp_sp")
                conn.commit()
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT sync_ext_exp_sp")

            items = []

            # 1. Fetch standard & approved production expenses from "Expense"
            exp_table = get_exact_table_name(cur, "Expense")
            if exp_table:
                e_cols = get_exact_cols(cur, exp_table)
                e_pk = e_cols.get("expenseid", "expenseID")
                e_acc = e_cols.get("accountid", "accountID")
                e_prod = e_cols.get("productionid", "productionID")
                e_post = e_cols.get("postingid", "postingID")
                e_amt = e_cols.get("amount", "amount")

                coa_table = get_exact_table_name(cur, "ChartOfAccounts")
                prod_table = get_exact_table_name(cur, "ProductionOrder")
                je_table = get_exact_table_name(cur, "JournalEntry")

                coa_join = ""
                coa_select = "NULL AS account_code, NULL AS account_name"
                if coa_table:
                    c_cols = get_exact_cols(cur, coa_table)
                    c_pk = c_cols.get("accountid", "accountID")
                    c_code = c_cols.get("accountcode", "accountCode")
                    c_name = c_cols.get("accountname", "accountName")
                    coa_join = f'LEFT JOIN "{coa_table}" c ON e."{e_acc}" = c."{c_pk}"'
                    coa_select = f'c."{c_code}" AS account_code, c."{c_name}" AS account_name'

                prod_join = ""
                prod_select = "NULL AS order_total_cost"
                if prod_table:
                    p_cols = get_exact_cols(cur, prod_table)
                    p_pk = p_cols.get("productionid", "productionID")
                    p_cost = (
                        p_cols.get("totalcost")
                        or p_cols.get("total_cost")
                        or p_cols.get("cost")
                        or p_cols.get("amount")
                    )
                    prod_join = f'LEFT JOIN "{prod_table}" p ON e."{e_prod}" = p."{p_pk}"'
                    if p_cost:
                        prod_select = f'p."{p_cost}" AS order_total_cost'

                je_join = ""
                je_select = "NULL AS description, NULL AS reference_no"
                if je_table:
                    j_cols = get_exact_cols(cur, je_table)
                    j_pk = j_cols.get("journalid", "journalID")
                    j_desc = j_cols.get("description", "description")
                    j_ref = j_cols.get("referenceno", "referenceNo")
                    je_join = f'LEFT JOIN "{je_table}" j ON e."{e_post}" = j."{j_pk}"'
                    je_select = f'j."{j_desc}" AS description, j."{j_ref}" AS reference_no'

                cur.execute(f"""
                    SELECT 
                        e."{e_pk}" AS "expenseID",
                        e."{e_acc}" AS "accountID",
                        e."{e_prod}" AS "productionID",
                        e."{e_post}" AS "postingID",
                        e."{e_amt}" AS "amount",
                        {coa_select},
                        {prod_select},
                        {je_select},
                        'Expense' AS source_type
                    FROM "{exp_table}" e
                    {coa_join}
                    {prod_join}
                    {je_join}
                    ORDER BY e."{e_pk}" DESC
                """)
                items.extend(cur.fetchall())

                            # 2. Include HR Payroll runs from "PayrollExpense"
            pay_table = get_exact_table_name(cur, "PayrollExpense")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                pk_col = p_cols.get("payrollexpenseid", "payrollExpenseID")
                pid_col = p_cols.get("payroll_id", "payroll_id")
                amt_col = p_cols.get("amount", "amount")
                je_table = get_exact_table_name(cur, "JournalEntry")

                if je_table:
                    cur.execute(f"""
                        SELECT 
                            p."{pk_col}" AS "payrollExpenseID",
                            p."{pid_col}" AS "payroll_id",
                            p."{amt_col}" AS "amount",
                            j."journalID" AS "postingID",
                            j."referenceNo" AS "reference_no"
                        FROM "{pay_table}" p
                        LEFT JOIN "{je_table}" j
                          ON j."sourceModule" = 'Payroll' AND j."sourceID" = p."{pk_col}"
                        ORDER BY p."{pk_col}" DESC
                    """)
                else:
                    cur.execute(f"""
                        SELECT 
                            "{pk_col}" AS "payrollExpenseID",
                            "{pid_col}" AS "payroll_id",
                            "{amt_col}" AS "amount",
                            NULL AS "postingID",
                            NULL AS "reference_no"
                        FROM "{pay_table}"
                        ORDER BY "{pk_col}" DESC
                    """)

                for pr in cur.fetchall():
                    items.append({
                        "expenseID": f"PR-{pr['payrollExpenseID']}",
                        "payrollExpenseID": pr["payrollExpenseID"],
                        "accountID": None,
                        "account_code": "5100",
                        "account_name": "Salaries & Wages Expense",
                        "productionID": None,
                        "postingID": pr["postingID"],
                        "reference_no": pr["reference_no"],
                        "description": f"HR Payroll Run #{pr['payroll_id']}",
                        "amount": float(pr["amount"] or 0),
                        "source_type": "Payroll",
                    })

            # 3. Safely read directly from "ProductionOrder" without hardcoding missing columns
            po_table = get_exact_table_name(cur, "ProductionOrder")
            if po_table:
                po_cols = get_exact_cols(cur, po_table)
                po_pk = po_cols.get("productionid") or next((orig for low, orig in po_cols.items() if "id" in low), None)
                po_prod = po_cols.get("productid") or po_cols.get("product_id") or po_cols.get("pm_id")
                po_qty = po_cols.get("quantity") or po_cols.get("qty") or po_cols.get("quantityproduced")
                po_cost = (
                    po_cols.get("totalcost")
                    or po_cols.get("total_cost")
                    or po_cols.get("cost")
                    or po_cols.get("amount")
                    or next((orig for low, orig in po_cols.items() if "cost" in low or "amount" in low or "total" in low), None)
                )

                if po_pk and po_cost:
                    prod_sel = f'po."{po_prod}" AS "productID"' if po_prod else 'NULL AS "productID"'
                    qty_sel = f'po."{po_qty}" AS "quantity"' if po_qty else '0 AS "quantity"'

                    if exp_table:
                        e_cols = get_exact_cols(cur, exp_table)
                        e_prod = e_cols.get("productionid", "productionID")
                        cur.execute(f"""
                            SELECT 
                                po."{po_pk}" AS "productionID",
                                {prod_sel},
                                {qty_sel},
                                po."{po_cost}" AS "totalCost"
                            FROM "{po_table}" po
                            WHERE COALESCE(po."{po_cost}", 0) > 0
                              AND NOT EXISTS (
                                  SELECT 1 FROM "{exp_table}" e WHERE e."{e_prod}" = po."{po_pk}"
                              )
                            ORDER BY po."{po_pk}" DESC
                        """)
                    else:
                        cur.execute(f"""
                            SELECT 
                                po."{po_pk}" AS "productionID",
                                {prod_sel},
                                {qty_sel},
                                po."{po_cost}" AS "totalCost"
                            FROM "{po_table}" po
                            WHERE COALESCE(po."{po_cost}", 0) > 0
                            ORDER BY po."{po_pk}" DESC
                        """)

                    for po in cur.fetchall():
                        pid = po["productionID"]
                        qty = po.get("quantity") or 0
                        prod_id = po.get("productID")
                        label_extra = f" (Product #{prod_id}, Qty: {qty})" if prod_id else (f" (Qty: {qty})" if qty else "")
                        items.append({
                            "expenseID": f"PO-{pid}",
                            "productionOrderID": pid,
                            "accountID": None,
                            "account_code": "5010",
                            "account_name": "Cost of Goods Sold / Production Cost",
                            "productionID": pid,
                            "postingID": None,
                            "reference_no": None,
                            "description": f"Production Order #{pid}{label_extra}",
                            "amount": float(po["totalCost"] or 0),
                            "source_type": "ProductionOrder",
                        })

            return items
    finally:
        conn.close()


@router.get("/options")
def get_expense_options():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            auto_sync_external_expenses(cur)
            conn.commit()

            accounts = []
            coa_table = get_exact_table_name(cur, "ChartOfAccounts")
            if coa_table:
                cur.execute(f'SELECT * FROM "{coa_table}" ORDER BY 2 ASC')
                accounts = cur.fetchall()

            productions = []
            prod_table = get_exact_table_name(cur, "ProductionOrder")
            if prod_table:
                cur.execute(f'SELECT * FROM "{prod_table}" ORDER BY 1 DESC')
                productions = cur.fetchall()

            payroll_total = 0.0
            pay_table = get_exact_table_name(cur, "PayrollExpense")
            if pay_table:
                p_cols = get_exact_cols(cur, pay_table)
                amt_col = p_cols.get("amount", "amount")
                cur.execute(f'SELECT COALESCE(SUM("{amt_col}"), 0) AS s FROM "{pay_table}"')
                payroll_total = float(cur.fetchone()["s"])

            return {
                "accounts": accounts,
                "productions": productions,
                "payrollTotal": payroll_total,
            }
    finally:
        conn.close()

@router.post("/")
def create_expense(payload: NewExpensePayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            exp_table = get_exact_table_name(cur, "Expense") or "Expense"
            e_cols = get_exact_cols(cur, exp_table)
            desc_text = payload.description.strip() or "Operating Expense"
            auto_journal_id = None

            # Auto-post to JournalEntry & GeneralLedger
            cur.execute('SELECT "accountID" FROM "ChartOfAccounts" WHERE "accountCode" IN (\'1020\', \'1010\') OR "accountName" ILIKE \'%Bank%\' LIMIT 1')
            cash_acc = cur.fetchone()

            if cash_acc:
                cur.execute("""
                    INSERT INTO "JournalEntry" ("journalDate", "referenceNo", "sourceModule", "description")
                    VALUES (CURRENT_DATE, 'EXP-AUTO', 'Expenses', %s)
                    RETURNING "journalID"
                """, (desc_text,))
                auto_journal_id = cur.fetchone()["journalID"]

                cur.execute('UPDATE "JournalEntry" SET "referenceNo" = %s WHERE "journalID" = %s', (f"EXP-{str(auto_journal_id).zfill(4)}", auto_journal_id))
                cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (auto_journal_id, payload.accountID, payload.amount))
                cur.execute('INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (auto_journal_id, cash_acc["accountID"], payload.amount))
                cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (payload.accountID, auto_journal_id, payload.amount, payload.amount))
                cur.execute('INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (cash_acc["accountID"], auto_journal_id, payload.amount, -payload.amount))

            # Insert into Expense
            insert_cols = [f'"{e_cols.get("accountid", "accountID")}"', f'"{e_cols.get("amount", "amount")}"']
            insert_vals = [payload.accountID, payload.amount]

            if payload.productionID is not None and "productionid" in e_cols:
                insert_cols.append(f'"{e_cols["productionid"]}"')
                insert_vals.append(payload.productionID)
            if auto_journal_id is not None and "postingid" in e_cols:
                insert_cols.append(f'"{e_cols["postingid"]}"')
                insert_vals.append(auto_journal_id)

            ph = ", ".join(["%s"] * len(insert_vals))
            cur.execute(f'INSERT INTO "{exp_table}" ({", ".join(insert_cols)}) VALUES ({ph}) RETURNING *', tuple(insert_vals))
            created = cur.fetchone()
            conn.commit()
            return created
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/from-production")
def receive_production_expense(payload: ProductionCostRequest):
    if payload.totalCost <= 0:
        raise HTTPException(status_code=400, detail="Total production cost must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            prod_table = get_exact_table_name(cur, "ProductionOrder") or "ProductionOrder"
            exp_table = get_exact_table_name(cur, "Expense") or "Expense"
            p_cols = get_exact_cols(cur, prod_table)
            e_cols = get_exact_cols(cur, exp_table)

            p_pk = p_cols.get("productionid", "productionID")
            p_prod = p_cols.get("productid", "productID")
            p_qty = p_cols.get("quantity", "quantity")
            p_cost = p_cols.get("totalcost", "totalCost")

            cur.execute(f"""
                INSERT INTO "{prod_table}" ("{p_pk}", "{p_prod}", "{p_qty}", "{p_cost}")
                VALUES (%s, %s, %s, %s)
                ON CONFLICT ("{p_pk}") DO UPDATE
                SET "{p_qty}" = EXCLUDED."{p_qty}",
                    "{p_cost}" = EXCLUDED."{p_cost}"
            """, (payload.productionID, payload.productID, payload.quantity, payload.totalCost))

            cur.execute(f"""
                INSERT INTO "{exp_table}" (
                    "{e_cols.get('accountid', 'accountID')}",
                    "{e_cols.get('productionid', 'productionID')}",
                    "{e_cols.get('amount', 'amount')}"
                )
                VALUES (%s, %s, %s)
                RETURNING *
            """, (payload.accountID, payload.productionID, payload.totalCost))

            created_expense = cur.fetchone()
            conn.commit()
            return {
                "message": "Production cost queued in Finance Expenses",
                "expense": created_expense
            }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/pricing-alerts")
def get_pricing_alerts(margin_pct: float = 20.0, vat_pct: float = 12.0):
    """
    Sends Sales the VAT-exclusive minimum selling price (unitCost + 20% margin)
    and the 12% VAT-inclusive minimum price for every production batch.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            po_table = get_exact_table_name(cur, "ProductionOrder")
            exp_table = get_exact_table_name(cur, "Expense")
            if not po_table:
                return []

            po_cols = get_exact_cols(cur, po_table)
            po_pk = po_cols.get("productionid") or next((orig for low, orig in po_cols.items() if "id" in low), None)
            po_prod = po_cols.get("productid") or po_cols.get("product_id") or po_cols.get("pm_id")
            po_qty = po_cols.get("quantity") or po_cols.get("qty") or po_cols.get("quantityproduced")
            po_cost = (
                po_cols.get("totalcost")
                or po_cols.get("total_cost")
                or po_cols.get("cost")
                or po_cols.get("amount")
                or next((orig for low, orig in po_cols.items() if "cost" in low or "amount" in low or "total" in low), None)
            )

            if not po_pk:
                return []

            prod_sel = f'po."{po_prod}" AS "productID"' if po_prod else 'NULL AS "productID"'
            qty_sel = f'po."{po_qty}" AS "quantity"' if po_qty else '1 AS "quantity"'

            # Use ProductionOrder's cost column if present; otherwise fall back to linked Expense amount
            if po_cost:
                cur.execute(f"""
                    SELECT
                        po."{po_pk}" AS "productionID",
                        {prod_sel},
                        {qty_sel},
                        COALESCE(po."{po_cost}", 0) AS "totalCost"
                    FROM "{po_table}" po
                    WHERE COALESCE(po."{po_cost}", 0) > 0
                    ORDER BY po."{po_pk}" DESC
                """)
            elif exp_table:
                e_cols = get_exact_cols(cur, exp_table)
                e_prod = e_cols.get("productionid", "productionID")
                e_amt = e_cols.get("amount", "amount")
                cur.execute(f"""
                    SELECT
                        po."{po_pk}" AS "productionID",
                        {prod_sel},
                        {qty_sel},
                        COALESCE(SUM(e."{e_amt}"), 0) AS "totalCost"
                    FROM "{po_table}" po
                    JOIN "{exp_table}" e ON e."{e_prod}" = po."{po_pk}"
                    GROUP BY po."{po_pk}"{f', po."{po_prod}"' if po_prod else ''}{f', po."{po_qty}"' if po_qty else ''}
                    HAVING COALESCE(SUM(e."{e_amt}"), 0) > 0
                    ORDER BY po."{po_pk}" DESC
                """)
            else:
                return []

            alerts = []
            for r in cur.fetchall():
                qty = max(float(r["quantity"] or 1), 1.0)
                total_cost = float(r["totalCost"] or 0)
                unit_cost = total_cost / qty
                min_price_vat_ex = unit_cost * (1.0 + (margin_pct / 100.0))
                vat_amount = min_price_vat_ex * (vat_pct / 100.0)
                min_price_vat_inc = min_price_vat_ex + vat_amount

                alerts.append({
                    "productionID": r["productionID"],
                    "productID": r["productID"],
                    "quantity": qty,
                    "totalBatchCost": round(total_cost, 2),
                    "unitCost": round(unit_cost, 2),
                    "targetMarginPct": margin_pct,
                    "minSellingPrice": round(min_price_vat_ex, 2),
                    "vatPct": vat_pct,
                    "estimatedVatAmount": round(vat_amount, 2),
                    "minSellingPriceVatInclusive": round(min_price_vat_inc, 2),
                    "taxNote": "Sales adds markup on top of minSellingPrice (VAT-Ex), then applies 12% VAT into sales_invoice.tax_amount.",
                })
            return alerts
    finally:
        conn.close()


@router.post("/from-payroll")
def receive_payroll_request(payload: PayrollRequestPayload):
    """Team 6 (HRIS & Payroll) calls this endpoint when a payroll run is finalized."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payroll amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pay_table = get_exact_table_name(cur, "PayrollExpense") or "PayrollExpense"
            p_cols = get_exact_cols(cur, pay_table)
            pid_col = p_cols.get("payroll_id", "payroll_id")
            amt_col = p_cols.get("amount", "amount")

            cur.execute(f"""
                INSERT INTO "{pay_table}" ("{pid_col}", "{amt_col}")
                VALUES (%s, %s)
                RETURNING *
            """, (payload.payroll_id, payload.amount))
            created = cur.fetchone()
            conn.commit()
            return {
                "message": "Payroll expense received by Finance",
                "payrollExpense": created
            }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/payroll-requests")
def get_payroll_requests():
    """Lists all incoming payroll runs from Team 6 (auto-synced from shared DB)."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            auto_sync_external_expenses(cur)
            conn.commit()

            pay_table = get_exact_table_name(cur, "PayrollExpense")
            if not pay_table:
                return []
            cur.execute(f'SELECT * FROM "{pay_table}" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/pay-payroll")
def pay_payroll(payload: PayPayrollPayload):
    """Finance disburses cash from BankAccount and records a balanced Journal Entry."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            pay_table = get_exact_table_name(cur, "PayrollExpense") or "PayrollExpense"
            p_cols = get_exact_cols(cur, pay_table)
            pk_col = p_cols.get("payrollexpenseid", "payrollExpenseID")
            pid_col = p_cols.get("payroll_id", "payroll_id")
            amt_col = p_cols.get("amount", "amount")

            cur.execute(f'SELECT * FROM "{pay_table}" WHERE "{pk_col}" = %s', (payload.payrollExpenseID,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Payroll expense record not found")

            amount = float(row[amt_col] or 0)
            payroll_ref = f"PAYROLL-{row[pid_col]}"

            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            coa_table = get_exact_table_name(cur, "ChartOfAccounts")

            if je_table and jel_table and coa_table:
                je_cols = get_exact_cols(cur, je_table)
                jel_cols = get_exact_cols(cur, jel_table)
                c_cols = get_exact_cols(cur, coa_table)

                c_id = c_cols.get("accountid", "accountID")
                c_code = c_cols.get("accountcode", "accountCode")
                c_name = c_cols.get("accountname", "accountName")
                c_type = c_cols.get("accounttype", "accountType")

                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE "{c_code}" IN ('5100', '5000')
                       OR "{c_name}" ILIKE '%Salary%'
                       OR "{c_name}" ILIKE '%Payroll%'
                       OR LOWER("{c_type}") = 'expense'
                    ORDER BY "{c_code}" ASC LIMIT 1
                """)
                exp_acc = cur.fetchone()

                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE "{c_code}" IN ('1020', '1010')
                       OR "{c_name}" ILIKE '%Bank%'
                       OR "{c_name}" ILIKE '%Cash%'
                       OR LOWER("{c_type}") = 'asset'
                    ORDER BY "{c_code}" ASC LIMIT 1
                """)
                cash_acc = cur.fetchone()

                if exp_acc and cash_acc:
                    cur.execute(f"""
                        INSERT INTO "{je_table}" (
                            "{je_cols.get('journaldate', 'journalDate')}",
                            "{je_cols.get('referenceno', 'referenceNo')}",
                            "{je_cols.get('sourcemodule', 'sourceModule')}",
                            "{je_cols.get('description', 'description')}",
                            "{je_cols.get('sourceid', 'sourceID')}"
                        )
                        VALUES (%s, %s, 'Payroll', %s, %s)
                        RETURNING "{je_cols.get('journalid', 'journalID')}" AS id
                    """, (
                        payload.paymentDate,
                        payroll_ref,
                        f"Payroll Disbursement via Bank #{payload.bankAccountID}",
                        payload.payrollExpenseID,
                    ))
                    journal_id = cur.fetchone()["id"]

                    cur.execute(f"""
                        INSERT INTO "{jel_table}" (
                            "{jel_cols.get('journalid', 'journalID')}",
                            "{jel_cols.get('accountid', 'accountID')}",
                            "{jel_cols.get('debit', 'debit')}",
                            "{jel_cols.get('credit', 'credit')}"
                        )
                        VALUES (%s, %s, %s, 0)
                    """, (journal_id, exp_acc["id"], amount))


                    cur.execute(f"""
                        INSERT INTO "{jel_table}" (
                            "{jel_cols.get('journalid', 'journalID')}",
                            "{jel_cols.get('accountid', 'accountID')}",
                            "{jel_cols.get('debit', 'debit')}",
                            "{jel_cols.get('credit', 'credit')}"
                        )
                        VALUES (%s, %s, 0, %s)
                    """, (journal_id, cash_acc["id"], amount))

            conn.commit()
            return {
                "message": f"Payroll #{row[pid_col]} paid from Bank Account #{payload.bankAccountID}",
                "amountPaid": amount,
                "referenceNo": payroll_ref,
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()



@router.post("/batch-approve")
def batch_approve_expenses(payload: BatchApproveExpensesPayload):
    if not payload.expenseIds and not payload.payrollIds and not payload.productionOrderIds:
        raise HTTPException(status_code=400, detail="Please select at least one pending item to approve.")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            gl_table = get_exact_table_name(cur, "GeneralLedger")
            coa_table = get_exact_table_name(cur, "ChartOfAccounts")

            cash_acc_id = None
            inv_acc_id = None
            sal_acc_id = None
            cogs_acc_id = None

            if coa_table:
                c_cols = get_exact_cols(cur, coa_table)
                c_id = c_cols.get("accountid", "accountID")
                c_code = c_cols.get("accountcode", "accountCode")
                c_name = c_cols.get("accountname", "accountName")
                c_type = c_cols.get("accounttype", "accountType")

                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE "{c_code}" IN ('1020', '1010') OR "{c_name}" ILIKE '%Bank%' OR "{c_name}" ILIKE '%Cash%'
                    ORDER BY "{c_code}" ASC LIMIT 1
                """)
                r = cur.fetchone()
                cash_acc_id = r["id"] if r else None

                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE "{c_code}" IN ('1300', '1400', '2010') OR "{c_name}" ILIKE '%Inventory%' OR "{c_name}" ILIKE '%Payable%'
                    ORDER BY "{c_code}" ASC LIMIT 1
                """)
                r2 = cur.fetchone()
                inv_acc_id = r2["id"] if r2 else cash_acc_id

                # Strictly select Salaries & Wages Expense (never Accrued/Payable Liability)
                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE LOWER("{c_type}") LIKE 'expense%'
                      AND "{c_name}" NOT ILIKE '%Payable%'
                      AND "{c_name}" NOT ILIKE '%Accrued%'
                      AND (
                          "{c_name}" ILIKE '%Salar%'
                          OR "{c_name}" ILIKE '%Wage%'
                          OR "{c_name}" ILIKE '%Payroll%'
                      )
                    ORDER BY
                        CASE WHEN "{c_name}" ILIKE '%Salar%' THEN 1
                             WHEN "{c_name}" ILIKE '%Wage%' THEN 2
                             ELSE 3 END,
                        "{c_code}" ASC
                    LIMIT 1
                """)
                r3 = cur.fetchone()
                sal_acc_id = r3["id"] if r3 else None

                # Select 5010 COGS / Production Cost Expense account
                cur.execute(f"""
                    SELECT "{c_id}" AS id FROM "{coa_table}"
                    WHERE "{c_code}" IN ('5010', '5000')
                       OR "{c_name}" ILIKE '%Production%'
                       OR "{c_name}" ILIKE '%Cost of Goods%'
                    ORDER BY CASE WHEN "{c_code}" = '5010' THEN 1 ELSE 2 END, "{c_code}" ASC
                    LIMIT 1
                """)
                r4 = cur.fetchone()
                cogs_acc_id = r4["id"] if r4 else sal_acc_id

            approved_prod = 0
            approved_pay = 0
            expense_ids = list(payload.expenseIds)

            # 0. Convert any selected ProductionOrder rows (PO-#) into "Expense" rows first
            exp_table = get_exact_table_name(cur, "Expense")
            po_table = get_exact_table_name(cur, "ProductionOrder")
            if po_table and exp_table and payload.productionOrderIds:
                po_cols = get_exact_cols(cur, po_table)
                po_pk = po_cols.get("productionid", "productionID")
                po_cost = po_cols.get("totalcost") or po_cols.get("total_cost") or "totalCost"
                e_cols = get_exact_cols(cur, exp_table)
                e_pk = e_cols.get("expenseid", "expenseID")
                e_acc = e_cols.get("accountid", "accountID")
                e_prod = e_cols.get("productionid", "productionID")
                e_amt = e_cols.get("amount", "amount")

                for poid in payload.productionOrderIds:
                    cur.execute(f'SELECT "{e_pk}" AS eid FROM "{exp_table}" WHERE "{e_prod}" = %s LIMIT 1', (poid,))
                    existing = cur.fetchone()
                    if existing:
                        if existing["eid"] not in expense_ids:
                            expense_ids.append(existing["eid"])
                        continue

                    cur.execute(f'SELECT "{po_cost}" AS cost FROM "{po_table}" WHERE "{po_pk}" = %s', (poid,))
                    po_row = cur.fetchone()
                    if po_row and float(po_row["cost"] or 0) > 0 and cogs_acc_id:
                        cur.execute(f"""
                            INSERT INTO "{exp_table}" ("{e_acc}", "{e_prod}", "{e_amt}")
                            VALUES (%s, %s, %s)
                            RETURNING "{e_pk}" AS eid
                        """, (cogs_acc_id, poid, float(po_row["cost"])))
                        expense_ids.append(cur.fetchone()["eid"])

                        # 1. Approve & Post Selected Production Expenses
            if exp_table and expense_ids:
                e_cols = get_exact_cols(cur, exp_table)
                e_pk = e_cols.get("expenseid", "expenseID")
                e_acc = e_cols.get("accountid", "accountID")
                e_prod = e_cols.get("productionid", "productionID")
                e_post = e_cols.get("postingid", "postingID")
                e_amt = e_cols.get("amount", "amount")

                for eid in expense_ids:
                    cur.execute(f'SELECT * FROM "{exp_table}" WHERE "{e_pk}" = %s', (eid,))
                    exp_row = cur.fetchone()
                    if not exp_row or exp_row.get(e_post) is not None:
                        continue

                    amt = float(exp_row.get(e_amt) or 0)
                    acc_id = exp_row.get(e_acc)
                    prod_id = exp_row.get(e_prod)
                    ref_no = f"PROD-{str(eid).zfill(4)}"
                    desc = f"Approved Production Batch #{prod_id} Cost" if prod_id else f"Approved Expense #{eid}"

                    if je_table and jel_table and acc_id and inv_acc_id and amt > 0:
                        cur.execute(f"""
                            INSERT INTO "{je_table}" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
                            VALUES (COALESCE(%s::date, CURRENT_DATE), %s, 'Production Cost', %s, %s)
                            RETURNING "journalID"
                        """, (payload.approvalDate, ref_no, desc, eid))
                        jid = cur.fetchone()["journalID"]

                        cur.execute(f'INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, acc_id, amt))
                        cur.execute(f'INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, inv_acc_id, amt))

                        if gl_table:
                            cur.execute(f'INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (acc_id, jid, amt, amt))
                            cur.execute(f'INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (inv_acc_id, jid, amt, -amt))

                        cur.execute(f'UPDATE "{exp_table}" SET "{e_post}" = %s WHERE "{e_pk}" = %s', (jid, eid))
                        approved_prod += 1

            # 2. Approve & Post Selected HR Payroll Runs (Direct to JournalEntry & GeneralLedger)
            pay_table = get_exact_table_name(cur, "PayrollExpense")
            if pay_table and payload.payrollIds:
                p_cols = get_exact_cols(cur, pay_table)
                pk_col = p_cols.get("payrollexpenseid", "payrollExpenseID")
                pid_col = p_cols.get("payroll_id", "payroll_id")
                amt_col = p_cols.get("amount", "amount")

                for prid in payload.payrollIds:
                    cur.execute(f'SELECT * FROM "{pay_table}" WHERE "{pk_col}" = %s', (prid,))
                    prow = cur.fetchone()
                    if not prow:
                        continue

                    if je_table:
                        cur.execute(f'SELECT 1 FROM "{je_table}" WHERE "sourceModule" = \'Payroll\' AND "sourceID" = %s', (prid,))
                        if cur.fetchone():
                            continue

                    amt = float(prow.get(amt_col) or 0)
                    run_id = prow.get(pid_col)
                    ref_no = f"PAYROLL-{run_id}"
                    desc = f"Payroll Run #{run_id} Disbursed (BDO Corporate Checking -> BPI Payroll)"

                    if je_table and jel_table and sal_acc_id and cash_acc_id and amt > 0:
                        cur.execute(f"""
                            INSERT INTO "{je_table}" ("journalDate", "referenceNo", "sourceModule", "description", "sourceID")
                            VALUES (COALESCE(%s::date, CURRENT_DATE), %s, 'Payroll', %s, %s)
                            RETURNING "journalID"
                        """, (payload.approvalDate, ref_no, desc, prid))
                        jid = cur.fetchone()["journalID"]

                        cur.execute(f'INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, %s, 0)', (jid, sal_acc_id, amt))
                        cur.execute(f'INSERT INTO "JournalEntryLine" ("journalID", "accountID", "debit", "credit") VALUES (%s, %s, 0, %s)', (jid, cash_acc_id, amt))

                        if gl_table:
                            cur.execute(f'INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, %s, 0, %s)', (sal_acc_id, jid, amt, amt))
                            cur.execute(f'INSERT INTO "GeneralLedger" ("accountID", "journalID", "debitAmount", "creditAmount", "runningBalance") VALUES (%s, %s, 0, %s, %s)', (cash_acc_id, jid, amt, -amt))

                    approved_pay += 1

            conn.commit()
            return {
                "message": f"Approved & posted {approved_prod} production expense(s) and {approved_pay} payroll run(s) to Journal Entries.",
                "approvedProduction": approved_prod,
                "approvedPayroll": approved_pay,
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
