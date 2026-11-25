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
    """Automatically pulls new rows from public.sales_invoice (joining order_id for customer_id) and deposits into BPI Sales."""
    ar_table = get_exact_table_name(cur, "ARInvoice")
    rec_table = get_exact_table_name(cur, "ARReceipt")
    bank_table = get_exact_table_name(cur, "BankAccount")
    sales_table = get_exact_table_name(cur, "sales_invoice")
    if not (ar_table and sales_table):
        return 0

    # Find BPI Sales receiver bank ID
    bpi_sales_id = None
    if bank_table:
        b_cols = get_exact_cols(cur, bank_table)
        b_pk = b_cols.get("bankaccountid", "bankAccountID")
        b_name = b_cols.get("bankname", "bankName")
        b_rec = b_cols.get("isreceiver")
        cond = f'"{b_name}" ILIKE \'%BPI Sales%\' OR COALESCE("{b_rec}", FALSE) = TRUE' if b_rec else f'"{b_name}" ILIKE \'%BPI Sales%\''
        cur.execute(f'SELECT "{b_pk}" AS id FROM "{bank_table}" WHERE {cond} ORDER BY "{b_pk}" ASC LIMIT 1')
        b_row = cur.fetchone()
        bpi_sales_id = b_row["id"] if b_row else None

    # Auto-detect parent orders table linked to sales_invoice.order_id for customer_id
    cur.execute("""
        SELECT ccu.table_name AS ord_tbl, ccu.column_name AS ord_pk
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND LOWER(tc.table_name) = 'sales_invoice'
          AND LOWER(kcu.column_name) = 'order_id'
        LIMIT 1
    """)
    fk_row = cur.fetchone()
    ord_join = ""
    cust_expr = "1"
    if fk_row:
        o_cols = get_exact_cols(cur, fk_row["ord_tbl"])
        o_cust = next((orig for low, orig in o_cols.items() if "cust" in low and "id" in low), None)
        if o_cust:
            ord_join = f'LEFT JOIN "{fk_row["ord_tbl"]}" o ON si."order_id" = o."{fk_row["ord_pk"]}"'
            cust_expr = f'COALESCE(o."{o_cust}", 1)'

    cur.execute(f"""
        SELECT
            si."invoice_id" AS sid,
            {cust_expr} AS cid,
            COALESCE(si."total_due", 0) AS amt,
            COALESCE(si."invoice_date"::date, CURRENT_DATE) AS inv_date,
            COALESCE(si."due_date"::date, CURRENT_DATE + INTERVAL '30 days') AS due_date
        FROM "{sales_table}" si
        {ord_join}
        WHERE COALESCE(si."total_due", 0) > 0
          AND NOT EXISTS (
              SELECT 1 FROM "{ar_table}" ar WHERE ar."salesInvoiceID" = si."invoice_id"
          )
        ORDER BY si."invoice_id" ASC
    """)
    rows = cur.fetchall()

    synced = 0
    for r in rows:
        amt = float(r["amt"])
        cur.execute(f"""
            INSERT INTO "{ar_table}" (
                "customerID", "salesInvoiceID", "amount", "totalPaid", "remainingBalance", "status", "dueDate"
            )
            VALUES (%s, %s, %s, %s, 0, 'Paid', %s)
            RETURNING "arInvoiceID" AS new_id
        """, (r["cid"], r["sid"], amt, amt, r["due_date"]))
        new_ar_id = cur.fetchone()["new_id"]

        if rec_table and bpi_sales_id:
            cur.execute(f"""
                INSERT INTO "{rec_table}" ("arInvoiceID", "bankAccountID", "paymentDate", "amount")
                VALUES (%s, %s, %s, %s)
            """, (new_ar_id, bpi_sales_id, r["inv_date"], amt))
        synced += 1

    return synced



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
