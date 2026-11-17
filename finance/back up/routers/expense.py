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