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
    productionID: int
    postingID: int | None = None
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
def get_expenses():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            exp_table = get_exact_table_name(cur, "Expense")
            if not exp_table:
                return []

            e_cols = get_exact_cols(cur, exp_table)
            e_pk = e_cols.get("expenseid", "expenseID")
            e_acc = e_cols.get("accountid", "accountID")
            e_prod = e_cols.get("productionid", "productionID")
            e_post = e_cols.get("postingid", "postingID")
            e_amt = e_cols.get("amount", "amount")

            coa_table = get_exact_table_name(cur, "ChartOfAccounts")
            prod_table = get_exact_table_name(cur, "ProductionOrder")

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
                p_cost = p_cols.get("totalcost")
                prod_join = f'LEFT JOIN "{prod_table}" p ON e."{e_prod}" = p."{p_pk}"'
                if p_cost:
                    prod_select = f'p."{p_cost}" AS order_total_cost'

            cur.execute(f"""
                SELECT 
                    e."{e_pk}" AS "expenseID",
                    e."{e_acc}" AS "accountID",
                    e."{e_prod}" AS "productionID",
                    e."{e_post}" AS "postingID",
                    e."{e_amt}" AS "amount",
                    {coa_select},
                    {prod_select}
                FROM "{exp_table}" e
                {coa_join}
                {prod_join}
                ORDER BY e."{e_pk}" DESC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/options")
def get_expense_options():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
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
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            exp_table = get_exact_table_name(cur, "Expense") or "Expense"
            e_cols = get_exact_cols(cur, exp_table)

            insert_cols = []
            insert_vals = []
            field_map = {
                "accountid": payload.accountID,
                "productionid": payload.productionID,
                "postingid": payload.postingID,
                "amount": payload.amount,
            }

            for key, val in field_map.items():
                if key in e_cols and val is not None:
                    insert_cols.append(f'"{e_cols[key]}"')
                    insert_vals.append(val)

            col_sql = ", ".join(insert_cols)
            ph_sql = ", ".join(["%s"] * len(insert_vals))

            cur.execute(f"""
                INSERT INTO "{exp_table}" ({col_sql})
                VALUES ({ph_sql})
                RETURNING *
            """, tuple(insert_vals))
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
def get_production_pricing_alerts(margin_pct: float = 20.0):
    """Returns the latest Unit Cost & Minimum Selling Price per productID for Sales (Team 4)."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            prod_table = get_exact_table_name(cur, "ProductionOrder")
            if not prod_table:
                return []

            p_cols = get_exact_cols(cur, prod_table)
            p_pk = p_cols.get("productionid", "productionID")
            p_prod = p_cols.get("productid", "productID")
            p_qty = p_cols.get("quantity", "quantity")
            p_cost = p_cols.get("totalcost", "totalCost")

            cur.execute(f'SELECT * FROM "{prod_table}" ORDER BY "{p_pk}" DESC')
            rows = cur.fetchall()

            latest_by_product = {}
            for row in rows:
                prod_id = row.get(p_prod)
                if prod_id in latest_by_product:
                    continue  # Keep the most recent production batch per product

                qty = float(row.get(p_qty) or 0)
                total = float(row.get(p_cost) or 0)
                unit_cost = round(total / qty, 2) if qty > 0 else 0.0
                min_price = round(unit_cost * (1 + (margin_pct / 100.0)), 2)

                latest_by_product[prod_id] = {
                    "productionID": row.get(p_pk),
                    "productID": prod_id,
                    "quantity": qty,
                    "totalCost": total,
                    "unitCost": unit_cost,
                    "marginPct": margin_pct,
                    "minSellingPrice": min_price,
                }

            return list(latest_by_product.values())
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
    """Lists all incoming payroll runs from Team 6."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
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

            # Record a balanced Journal Entry (Debit Salaries Expense, Credit Cash in Bank)
            je_table = get_exact_table_name(cur, "JournalEntry")
            jel_table = get_exact_table_name(cur, "JournalEntryLine")
            coa_table = get_exact_table_name(cur, "ChartOfAccounts")

            if je_table and jel_table and coa_table:
                je_cols = get_exact_cols(cur, je_table)
                jel_cols = get_exact_cols(cur, jel_table)
                c_cols = get_exact_cols(cur, coa_table)

                # Find Salaries Expense (5100) and Cash in Bank (1020)
                c_id = c_cols.get("accountid", "accountID")
                c_code = c_cols.get("accountcode", "accountCode")
                cur.execute(f'SELECT "{c_id}" AS id FROM "{coa_table}" WHERE "{c_code}" = \'5100\' LIMIT 1')
                exp_acc = cur.fetchone()
                cur.execute(f'SELECT "{c_id}" AS id FROM "{coa_table}" WHERE "{c_code}" = \'1020\' LIMIT 1')
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

                    # Debit Salaries Expense
                    cur.execute(f"""
                        INSERT INTO "{jel_table}" (
                            "{jel_cols.get('journalid', 'journalID')}",
                            "{jel_cols.get('accountid', 'accountID')}",
                            "{jel_cols.get('debit', 'debit')}",
                            "{jel_cols.get('credit', 'credit')}"
                        )
                        VALUES (%s, %s, %s, 0)
                    """, (journal_id, exp_acc["id"], amount))

                    # Credit Cash in Bank
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