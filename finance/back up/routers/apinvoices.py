from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/apinvoices",
    tags=["Accounts Payable"]
)

class NewAPInvoice(BaseModel):
    supplierID: int
    invoiceNumber: str | None = None
    dueDate: str
    amount: float

@router.get("/")
def get_ap_invoices():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    a.*,
                    s."SupplierName" AS supplier_name
                FROM "APInvoice" a
                LEFT JOIN "Supplier" s 
                    ON a."supplierID" = s."SupplierID"
                ORDER BY a."dueDate" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/suppliers")
def get_active_suppliers():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT "SupplierID", "SupplierName"
                FROM "Supplier"
                WHERE status = 'Active'
                ORDER BY "SupplierName" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/")
def create_ap_invoice(payload: NewAPInvoice):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                INSERT INTO "APInvoice" (
                    "supplierID", "invoiceNumber", "dueDate", "amount", "outstanding", "status"
                )
                VALUES (%s, %s, %s, %s, %s, 'Open')
                RETURNING *
            """, (
                payload.supplierID,
                payload.invoiceNumber,
                payload.dueDate,
                payload.amount,
                payload.amount,
            ))
            new_row = cur.fetchone()
            conn.commit()
            return new_row
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.patch("/{invoice_id}/pay")
def pay_ap_invoice(invoice_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                UPDATE "APInvoice"
                SET "outstanding" = 0,
                    "status" = 'Paid'
                WHERE "invoiceID" = %s
                RETURNING *
            """, (invoice_id,))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Invoice not found")
            conn.commit()
            return updated
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()