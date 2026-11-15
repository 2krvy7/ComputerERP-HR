from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

class SupplierIn(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    contact_person: str | None = None   # the person you negotiate with
    contact: str | None = None          # phone number
    email: EmailStr | None = None
    address: str | None = None

class SupplierUpdate(BaseModel):
    supplier_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_person: str | None = None
    contact: str | None = None
    email: EmailStr | None = None
    address: str | None = None

# column names come from this fixed map, never from user input
COLUMNS = {
    "supplier_name": "SupplierName",
    "contact_person": "ContactPerson",
    "contact": "Contact",
    "email": "Email",
    "address": "Address",
}
SELECT_COLS = '"SupplierID", "SupplierName", "ContactPerson", "Contact", "Email", "Address", "status"'


# Search happens here, in the database: ?search=pacific&status=Active|Archived|All
@router.get("/")
def list_suppliers(search: str | None = None, status: Literal["Active", "Archived", "All"] = "Active"):
    conditions: list[str] = []
    params: list = []

    if status != "All":
        conditions.append('"status" = %s')
        params.append(status)

    if search and search.strip():
        # escape % and _ so they are searched as normal characters
        text = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{text}%"
        conditions.append(
            '("SupplierName" ILIKE %s OR "ContactPerson" ILIKE %s OR "Contact" ILIKE %s '
            'OR "Email" ILIKE %s OR "Address" ILIKE %s)'
        )
        params.extend([like] * 5)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f'SELECT {SELECT_COLS} FROM public."Supplier"{where} ORDER BY "SupplierName"', params)
            return cur.fetchall()


# Works for archived suppliers too, because old orders still point to them
@router.get("/{supplier_id}")
def get_supplier(supplier_id: int):
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f'SELECT {SELECT_COLS} FROM public."Supplier" WHERE "SupplierID" = %s', (supplier_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return row


@router.post("/", status_code=201)
def create_supplier(s: SupplierIn):
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f'''INSERT INTO public."Supplier" ("SupplierName", "ContactPerson", "Contact", "Email", "Address")
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING {SELECT_COLS}''',
                (s.supplier_name, s.contact_person, s.contact, s.email, s.address),
            )
            return cur.fetchone()


@router.patch("/{supplier_id}")
def update_supplier(supplier_id: int, s: SupplierUpdate):
    fields = s.model_dump(exclude_unset=True)
    if not fields or fields.get("supplier_name", "x") is None:
        raise HTTPException(status_code=400, detail="Nothing valid to update")

    set_clause = ", ".join(f'"{COLUMNS[k]}" = %s' for k in fields)
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f'UPDATE public."Supplier" SET {set_clause} WHERE "SupplierID" = %s RETURNING {SELECT_COLS}',
                (*fields.values(), supplier_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return row


# Archive instead of delete: the supplier is hidden, but its history stays
def set_status(supplier_id: int, new_status: str):
    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f'UPDATE public."Supplier" SET "status" = %s WHERE "SupplierID" = %s RETURNING {SELECT_COLS}',
                (new_status, supplier_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return row

@router.patch("/{supplier_id}/archive")
def archive_supplier(supplier_id: int):
    return set_status(supplier_id, "Archived")

@router.patch("/{supplier_id}/restore")
def restore_supplier(supplier_id: int):
    return set_status(supplier_id, "Active")