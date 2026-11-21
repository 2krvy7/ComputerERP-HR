from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/arinvoices",
    tags=["Accounts Receivable"]
)

class NewARInvoicePayload(BaseModel):
    customerID: int
    salesInvoiceID: int | None = None
    amount: float
    dueDate: str
    status: str = "Sent"

class SalesInvoiceWebhookPayload(BaseModel):
    salesInvoiceID: int
    customerID: int
    amount: float
    dueDate: str

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

def auto_sync_sales_invoices(cur):
    """Safely pulls valid customer invoices from Team 4's Sales table into Finance ARInvoice."""
    ar_table = get_exact_table_name(cur, "ARInvoice")
    sales_table = (
        get_exact_table_name(cur, "sales_invoice")
        or get_exact_table_name(cur, "Sales Invoice")
        or get_exact_table_name(cur, "SalesInvoice")
        or get_exact_table_name(cur, "SALES_INVOICE")
    )
    if not (ar_table and sales_table):
        return 0

    ar_cols = get_exact_cols(cur, ar_table)
    s_cols = get_exact_cols(cur, sales_table)

    s_pk = (
        s_cols.get("salesinvoice_id")
        or s_cols.get("sales_invoice_id")
        or s_cols.get("salesinvoiceid")
        or s_cols.get("si_id")
        or s_cols.get("invoice_id")
        or s_cols.get("id")
    )
    s_cust = next((orig for low, orig in s_cols.items() if "cust" in low and "id" in low), None)
    s_amt = (
        s_cols.get("totalamount")
        or s_cols.get("total_amount")
        or s_cols.get("grand_total")
        or s_cols.get("amount")
        or s_cols.get("total")
    )
    s_date = next((orig for low, orig in s_cols.items() if "date" in low and "due" not in low), None)
    s_due = next((orig for low, orig in s_cols.items() if "due" in low), None)

    ar_si = ar_cols.get("salesinvoiceid")
    ar_cust = ar_cols.get("customerid")
    ar_amt = ar_cols.get("amount")
    ar_paid = ar_cols.get("totalpaid")
    ar_rem = ar_cols.get("remainingbalance")
    ar_stat = ar_cols.get("status")
    ar_due = ar_cols.get("duedate")

    # Require both salesInvoiceID and customerID so NOT NULL constraints never fail
    if not (s_pk and s_cust and s_amt and ar_si and ar_cust and ar_amt):
        return 0

    if s_due:
        due_expr = f'COALESCE(si."{s_due}"::date, CURRENT_DATE + INTERVAL \'30 days\')'
    elif s_date:
        due_expr = f'COALESCE(si."{s_date}"::date, CURRENT_DATE) + INTERVAL \'30 days\''
    else:
        due_expr = "CURRENT_DATE + INTERVAL '30 days'"

    ins_cols = [f'"{ar_si}"', f'"{ar_cust}"', f'"{ar_amt}"']
    sel_cols = [f'si."{s_pk}"', f'si."{s_cust}"', f'si."{s_amt}"']

    if ar_paid:
        ins_cols.append(f'"{ar_paid}"')
        sel_cols.append("0")
    if ar_rem:
        ins_cols.append(f'"{ar_rem}"')
        sel_cols.append(f'si."{s_amt}"')
    if ar_stat:
        ins_cols.append(f'"{ar_stat}"')
        sel_cols.append("'Sent'")
    if ar_due:
        ins_cols.append(f'"{ar_due}"')
        sel_cols.append(due_expr)

    cur.execute(f"""
        INSERT INTO "{ar_table}" ({", ".join(ins_cols)})
        SELECT {", ".join(sel_cols)}
        FROM "{sales_table}" si
        WHERE COALESCE(si."{s_amt}", 0) > 0
          AND si."{s_pk}" IS NOT NULL
          AND si."{s_cust}" IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM "{ar_table}" ar WHERE ar."{ar_si}" = si."{s_pk}"
          )
        RETURNING 1
    """)
    return len(cur.fetchall())


@router.get("/")
def get_ar_invoices():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # Protect auto-sync with a SAVEPOINT so GET /api/arinvoices/ never fails
            try:
                cur.execute("SAVEPOINT sync_sales_sp")
                auto_sync_sales_invoices(cur)
                cur.execute("RELEASE SAVEPOINT sync_sales_sp")
                conn.commit()
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT sync_sales_sp")

            ar_table = get_exact_table_name(cur, "ARInvoice")
            if not ar_table:
                return []

            ar_cols = get_exact_cols(cur, ar_table)
            ar_pk = ar_cols.get("arinvoiceid", "arInvoiceID")
            rec_table = get_exact_table_name(cur, "ARReceipt")

            if rec_table:
                r_cols = get_exact_cols(cur, rec_table)
                ar_amt = ar_cols.get("amount", "amount")
                ar_paid = ar_cols.get("totalpaid", "totalPaid")
                ar_rem = ar_cols.get("remainingbalance", "remainingBalance")
                ar_stat = ar_cols.get("status", "status")
                r_inv = r_cols.get("arinvoiceid", "arInvoiceID")
                r_amt = r_cols.get("amount", "amount")

                cur.execute(f"""
                    UPDATE "{ar_table}" a
                    SET "{ar_paid}" = COALESCE(r.paid_sum, 0),
                        "{ar_rem}" = GREATEST(a."{ar_amt}" - COALESCE(r.paid_sum, 0), 0),
                        "{ar_stat}" = CASE
                            WHEN a."{ar_amt}" - COALESCE(r.paid_sum, 0) <= 0 THEN 'Paid'
                            WHEN COALESCE(r.paid_sum, 0) > 0 THEN 'Partial'
                            ELSE a."{ar_stat}"
                        END
                    FROM (
                        SELECT "{r_inv}" AS inv_id, COALESCE(SUM("{r_amt}"), 0) AS paid_sum
                        FROM "{rec_table}"
                        GROUP BY "{r_inv}"
                    ) r
                    WHERE a."{ar_pk}" = r.inv_id
                """)
                conn.commit()

            cust_table = get_exact_table_name(cur, "Customer")
            if cust_table:
                c_cols = get_exact_cols(cur, cust_table)
                ar_cust = ar_cols.get("customerid")
                c_pk = c_cols.get("customerid") or c_cols.get("cust_id") or c_cols.get("id")
                c_name = next((orig for low, orig in c_cols.items() if "name" in low), None)
                if ar_cust and c_pk and c_name:
                    cur.execute(f"""
                        SELECT a.*, c."{c_name}" AS customer_name
                        FROM "{ar_table}" a
                        LEFT JOIN "{cust_table}" c ON a."{ar_cust}" = c."{c_pk}"
                        ORDER BY 1 DESC
                    """)
                    return cur.fetchall()

            cur.execute(f'SELECT * FROM "{ar_table}" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/customers")
def get_customers():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cust_table = get_exact_table_name(cur, "Customer")
            if not cust_table:
                return []
            cur.execute(f'SELECT * FROM "{cust_table}" ORDER BY 1 ASC')
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/receipts-summary")
def get_receipts_summary():
    """Calculates Collected Total strictly from money received by BPI Sales (excluding 5M BDO seed deposit)."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            rec_table = get_exact_table_name(cur, "ARReceipt")
            bank_table = get_exact_table_name(cur, "BankAccount")
            if not rec_table:
                return {"totalCollected": 0, "receiptCount": 0}

            r_cols = get_exact_cols(cur, rec_table)
            amt_col = r_cols.get("amount") or "amount"
            inv_col = r_cols.get("arinvoiceid") or "arInvoiceID"
            rbank_col = r_cols.get("bankaccountid") or "bankAccountID"

            if bank_table:
                b_cols = get_exact_cols(cur, bank_table)
                b_pk = b_cols.get("bankaccountid") or "bankAccountID"
                b_name = b_cols.get("bankname") or "bankName"
                b_rec = b_cols.get("isreceiver")

                role_filter = (
                    f'(b."{b_name}" ILIKE \'%BPI Sales%\' OR COALESCE(b."{b_rec}", FALSE) = TRUE)'
                    if b_rec
                    else f'b."{b_name}" ILIKE \'%BPI Sales%\''
                )

                cur.execute(f"""
                    SELECT 
                        COALESCE(SUM(r."{amt_col}"), 0) AS total_collected,
                        COUNT(*) AS receipt_count
                    FROM "{rec_table}" r
                    JOIN "{bank_table}" b ON r."{rbank_col}" = b."{b_pk}"
                    WHERE r."{inv_col}" != 1
                      AND {role_filter}
                """)
            else:
                cur.execute(f"""
                    SELECT 
                        COALESCE(SUM("{amt_col}"), 0) AS total_collected,
                        COUNT(*) AS receipt_count
                    FROM "{rec_table}"
                    WHERE "{inv_col}" != 1
                """)

            row = cur.fetchone()
            return {
                "totalCollected": float(row["total_collected"] or 0),
                "receiptCount": int(row["receipt_count"] or 0),
            }
    finally:
        conn.close()

@router.post("/sync-sales")
def trigger_sales_sync():
    """Manual trigger endpoint for the 'Sync from Sales' button on the AR Invoices page."""
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            count = auto_sync_sales_invoices(cur)
            conn.commit()
            return {"message": f"Synced {count} invoice(s) from Sales", "syncedCount": count}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/")
def create_ar_invoice(payload: NewARInvoicePayload):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invoice amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)

            insert_cols = []
            insert_vals = []
            field_map = {
                "customerid": payload.customerID,
                "salesinvoiceid": payload.salesInvoiceID,
                "amount": payload.amount,
                "totalpaid": 0,
                "remainingbalance": payload.amount,
                "status": payload.status,
                "duedate": payload.dueDate,
            }

            for key, val in field_map.items():
                if key in cols and val is not None:
                    insert_cols.append(f'"{cols[key]}"')
                    insert_vals.append(val)

            col_sql = ", ".join(insert_cols)
            ph_sql = ", ".join(["%s"] * len(insert_vals))

            cur.execute(f"""
                INSERT INTO "{ar_table}" ({col_sql})
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

@router.patch("/{invoice_id}/status")
def update_ar_status(invoice_id: int, status: str = "Sent"):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)
            pk_col = cols.get("arinvoiceid") or "arInvoiceID"
            stat_col = cols.get("status") or "status"
            rem_col = cols.get("remainingbalance") or "remainingBalance"
            paid_col = cols.get("totalpaid") or "totalPaid"
            amt_col = cols.get("amount") or "amount"

            if status.lower() == "paid":
                # Check remaining balance before marking Paid
                cur.execute(f'SELECT "{amt_col}" AS amt, COALESCE("{rem_col}", "{amt_col}") AS rem FROM "{ar_table}" WHERE "{pk_col}" = %s', (invoice_id,))
                inv = cur.fetchone()
                if not inv:
                    raise HTTPException(status_code=404, detail="AR Invoice not found")

                unpaid_amt = float(inv["rem"] or 0)

                cur.execute(f"""
                    UPDATE "{ar_table}"
                    SET "{stat_col}" = 'Paid',
                        "{paid_col}" = "{amt_col}",
                        "{rem_col}" = 0
                    WHERE "{pk_col}" = %s
                    RETURNING *
                """, (invoice_id,))
                updated = cur.fetchone()

                # Automatically deposit the unpaid balance into BPI Sales (isReceiver = TRUE)
                rec_table = get_exact_table_name(cur, "ARReceipt")
                bank_table = get_exact_table_name(cur, "BankAccount")
                if rec_table and bank_table and unpaid_amt > 0:
                    b_cols = get_exact_cols(cur, bank_table)
                    b_pk = b_cols.get("bankaccountid", "bankAccountID")
                    b_rec = b_cols.get("isreceiver")
                    where_rec = f'WHERE COALESCE("{b_rec}", TRUE) = TRUE' if b_rec else ""
                    cur.execute(f'SELECT "{b_pk}" AS id FROM "{bank_table}" {where_rec} ORDER BY "{b_pk}" ASC LIMIT 1')
                    rec_bank = cur.fetchone()

                    if rec_bank:
                        r_cols = get_exact_cols(cur, rec_table)
                        cur.execute(f"""
                            INSERT INTO "{rec_table}" (
                                "{r_cols.get('arinvoiceid', 'arInvoiceID')}",
                                "{r_cols.get('bankaccountid', 'bankAccountID')}",
                                "{r_cols.get('paymentdate', 'paymentDate')}",
                                "{r_cols.get('amount', 'amount')}"
                            )
                            VALUES (%s, %s, CURRENT_DATE, %s)
                        """, (invoice_id, rec_bank["id"], unpaid_amt))
            else:
                cur.execute(f"""
                    UPDATE "{ar_table}"
                    SET "{stat_col}" = %s
                    WHERE "{pk_col}" = %s
                    RETURNING *
                """, (status, invoice_id))
                updated = cur.fetchone()
                if not updated:
                    raise HTTPException(status_code=404, detail="AR Invoice not found")

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

@router.post("/from-sales")
def receive_sales_invoice(payload: SalesInvoiceWebhookPayload):
    """Team 4 (Sales) calls this endpoint when a customer Sales Invoice is issued."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Sales invoice amount must be greater than 0")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            ar_table = get_exact_table_name(cur, "ARInvoice") or "ARInvoice"
            cols = get_exact_cols(cur, ar_table)
            si_col = cols.get("salesinvoiceid", "salesInvoiceID")

            cur.execute(f'SELECT 1 FROM "{ar_table}" WHERE "{si_col}" = %s', (payload.salesInvoiceID,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="AR Invoice already exists for this Sales Invoice.")

            insert_cols = []
            insert_vals = []
            field_map = {
                "customerid": payload.customerID,
                "salesinvoiceid": payload.salesInvoiceID,
                "amount": payload.amount,
                "totalpaid": 0,
                "remainingbalance": payload.amount,
                "status": "Sent",
                "duedate": payload.dueDate,
            }

            for key, val in field_map.items():
                if key in cols and val is not None:
                    insert_cols.append(f'"{cols[key]}"')
                    insert_vals.append(val)

            col_sql = ", ".join(insert_cols)
            ph_sql = ", ".join(["%s"] * len(insert_vals))

            cur.execute(f"""
                INSERT INTO "{ar_table}" ({col_sql})
                VALUES ({ph_sql})
                RETURNING *
            """, tuple(insert_vals))
            created = cur.fetchone()
            conn.commit()
            return {"message": "Sales Invoice synced to Accounts Receivable", "arInvoice": created}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
