from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db_connection

router = APIRouter(
    prefix="/applicants",
    tags=["Applicants"]
)


class ApplicantCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    contact_no: str
    application_date: str
    status: str


class ApplicantUpdate(BaseModel):
    first_name: str
    last_name: str
    email: str
    contact_no: str
    application_date: str
    status: str


@router.get("/")
def get_applicants():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            applicant_id,
            first_name,
            last_name,
            email,
            contact_no,
            application_date,
            status
        FROM "Applicant"
        ORDER BY applicant_id DESC
    """)

    rows = cursor.fetchall()

    columns = [
        "applicant_id",
        "first_name",
        "last_name",
        "email",
        "contact_no",
        "application_date",
        "status"
    ]

    applicants = [
        dict(zip(columns, row))
        for row in rows
    ]

    cursor.close()
    conn.close()

    return applicants


@router.get("/{applicant_id}")
def get_applicant(applicant_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            applicant_id,
            first_name,
            last_name,
            email,
            contact_no,
            application_date,
            status
        FROM "Applicant"
        WHERE applicant_id = %s
    """, (applicant_id,))

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Applicant not found"
        )

    columns = [
        "applicant_id",
        "first_name",
        "last_name",
        "email",
        "contact_no",
        "application_date",
        "status"
    ]

    return dict(zip(columns, row))


@router.post("/")
def create_applicant(applicant: ApplicantCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO "Applicant"
        (
            first_name,
            last_name,
            email,
            contact_no,
            application_date,
            status
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING applicant_id
    """, (
        applicant.first_name,
        applicant.last_name,
        applicant.email,
        applicant.contact_no,
        applicant.application_date,
        applicant.status
    ))

    applicant_id = cursor.fetchone()[0]

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message": "Applicant created successfully",
        "applicant_id": applicant_id
    }


@router.put("/{applicant_id}")
def update_applicant(
    applicant_id: int,
    applicant: ApplicantUpdate
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE "Applicant"
        SET
            first_name = %s,
            last_name = %s,
            email = %s,
            contact_no = %s,
            application_date = %s,
            status = %s
        WHERE applicant_id = %s
    """, (
        applicant.first_name,
        applicant.last_name,
        applicant.email,
        applicant.contact_no,
        applicant.application_date,
        applicant.status,
        applicant_id
    ))

    if cursor.rowcount == 0:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Applicant not found"
        )

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message": "Applicant updated successfully"
    }


@router.delete("/{applicant_id}")
def delete_applicant(applicant_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM "Applicant"
        WHERE applicant_id = %s
    """, (applicant_id,))

    if cursor.rowcount == 0:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Applicant not found"
        )

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message": "Applicant deleted successfully"
    }