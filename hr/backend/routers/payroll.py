from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import re

from database import get_db_connection


router = APIRouter(prefix="/payroll", tags=["Payroll"])


# =========================================================
# MONEY HELPER
# =========================================================

def money(value):
    return Decimal(str(value or 0)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )


# =========================================================
# CONTRIBUTION CALCULATIONS
# =========================================================

def calculate_sss(monthly_salary):
    """
    Employee SSS share.

    MSC minimum = 5,000
    MSC maximum = 35,000
    Employee share = 5%

    This returns the semi-monthly employee share.
    """

    salary = max(
        Decimal("5000"),
        min(Decimal("35000"), monthly_salary)
    )

    monthly_sss = salary * Decimal("0.05")

    return money(
        monthly_sss / Decimal("2")
    )


def calculate_philhealth(monthly_salary):
    """
    PhilHealth:

    Total premium = 5%
    Employee share = 50%

    This returns the semi-monthly employee share.
    """

    salary = max(
        Decimal("10000"),
        min(Decimal("100000"), monthly_salary)
    )

    total_monthly_premium = (
        salary * Decimal("0.05")
    )

    employee_monthly_share = (
        total_monthly_premium / Decimal("2")
    )

    return money(
        employee_monthly_share / Decimal("2")
    )


def calculate_pagibig(monthly_salary):
    """
    Pag-IBIG:

    Employee contribution = 2%
    Maximum Fund Salary = 10,000
    Maximum employee contribution = 200/month

    This returns the semi-monthly employee share.
    """

    salary = min(
        Decimal("10000"),
        monthly_salary
    )

    monthly_pagibig = (
        salary * Decimal("0.02")
    )

    return money(
        monthly_pagibig / Decimal("2")
    )


# =========================================================
# PAY PERIOD PARSER
# =========================================================

def parse_pay_period(pay_period: str):
    """
    Supports:

    November 1-15, 2026
    November 16-30, 2026
    """

    pattern = r"""
        ^\s*
        ([A-Za-z]+)
        \s+
        (\d{1,2})
        \s*-\s*
        (\d{1,2})
        ,
        \s*
        (\d{4})
        \s*$
    """

    match = re.match(
        pattern,
        pay_period,
        re.VERBOSE
    )

    if not match:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid pay period format. "
                "Use example: November 1-15, 2026"
            )
        )

    month_name = match.group(1)
    start_day = int(match.group(2))
    end_day = int(match.group(3))
    year = int(match.group(4))

    try:
        month_number = datetime.strptime(
            month_name,
            "%B"
        ).month

    except ValueError:

        try:
            month_number = datetime.strptime(
                month_name,
                "%b"
            ).month

        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid month name in pay period."
            )

    try:
        start_date = date(
            year,
            month_number,
            start_day
        )

        end_date = date(
            year,
            month_number,
            end_day
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid dates in pay period."
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="Pay period end date cannot be before start date."
        )

    return start_date, end_date


# =========================================================
# ATTENDANCE CALCULATION
# =========================================================

def calculate_attendance(
    employee_id: int,
    pay_period: str,
    monthly_basic_salary: Decimal
):
    """
    Attendance rules:

    Present = normal
    Absent = 1 absence
    Late = counted separately

    Every 3 late days = 1 additional absence.

    Examples:

    3 late = 1 absence
    6 late = 2 absences
    5 late = 1 absence + 2 remaining late days
    """

    start_date, end_date = parse_pay_period(
        pay_period
    )

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT status
        FROM "Attendance"
        WHERE employee_id = %s
          AND date BETWEEN %s AND %s
    """, (
        employee_id,
        start_date,
        end_date
    ))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    present_days = 0
    late_days = 0
    absent_days = 0
    leave_days = 0

    for row in rows:

        status = str(
            row[0] or ""
        ).strip().lower()

        if status == "present":
            present_days += 1

        elif status == "late":
            late_days += 1

        elif status == "absent":
            absent_days += 1

        elif status == "leave":
            leave_days += 1

    # =====================================================
    # 3 LATE DAYS = 1 ABSENT
    # =====================================================

    late_converted_absences = (
        late_days // 3
    )

    remaining_late_days = (
        late_days % 3
    )

    total_absences = (
        absent_days +
        late_converted_absences
    )

    # =====================================================
    # DAILY RATE
    # =====================================================

    daily_rate = money(
        monthly_basic_salary /
        Decimal("26")
    )

    # =====================================================
    # ABSENCE DEDUCTION
    # =====================================================

    attendance_deduction = money(
        daily_rate *
        total_absences
    )

    return {
        "start_date": start_date,
        "end_date": end_date,

        "present_days":
            present_days,

        "late_days":
            late_days,

        "absent_days":
            absent_days,

        "leave_days":
            leave_days,

        "late_converted_absences":
            late_converted_absences,

        "remaining_late_days":
            remaining_late_days,

        "total_absences":
            total_absences,

        "daily_rate":
            daily_rate,

        "attendance_deduction":
            attendance_deduction
    }


# =========================================================
# FINANCE INTEGRATION
# =========================================================

def sync_pending_payroll_to_finance(
    cursor,
    payroll_id: int,
    amount: Decimal,
    payroll_status: str
):
    """
    Pushes pending payroll to the Finance module.

    HR Payroll:
        payroll_id
        net_salary
        payroll_status

    Finance PayrollExpense:
        payrollExpenseID
        payroll_id
        amount

    Only payrolls with Pending status are pushed.

    If the payroll already exists in PayrollExpense,
    its amount is updated instead of creating a duplicate.
    """

    status = str(
        payroll_status or ""
    ).strip().lower()

    # Only pending payrolls are sent to Finance.
    if status != "pending":
        return

    amount = money(amount)

    # Check if this payroll was already pushed to Finance.
    cursor.execute("""
        SELECT "payrollExpenseID"
        FROM "PayrollExpense"
        WHERE payroll_id = %s
    """, (payroll_id,))

    existing_expense = cursor.fetchone()

    if existing_expense:

        # Update the existing Finance expense.
        cursor.execute("""
            UPDATE "PayrollExpense"
            SET amount = %s
            WHERE payroll_id = %s
        """, (
            amount,
            payroll_id
        ))

    else:

        # Create a new Finance payroll expense.
        cursor.execute("""
            INSERT INTO "PayrollExpense"
            (
                payroll_id,
                amount
            )
            VALUES (%s, %s)
        """, (
            payroll_id,
            amount
        ))


# =========================================================
# PAYROLL MODELS
# =========================================================

class PayrollCreate(BaseModel):
    employee_id: int
    pay_period: str
    overtime: Decimal = 0
    gross_salary: Decimal = 0
    sss: Decimal = 0
    philhealth: Decimal = 0
    pag_ibig: Decimal = 0
    deductions: Decimal = 0
    net_salary: Decimal = 0
    thirteenth_month_pay: Decimal = 0
    payroll_status: str
    payment_date: date | None = None


class PayrollUpdate(BaseModel):
    employee_id: int
    pay_period: str
    overtime: Decimal = 0
    gross_salary: Decimal = 0
    sss: Decimal = 0
    philhealth: Decimal = 0
    pag_ibig: Decimal = 0
    deductions: Decimal = 0
    net_salary: Decimal = 0
    thirteenth_month_pay: Decimal = 0
    payroll_status: str
    payment_date: date | None = None


# =========================================================
# CALCULATE PAYROLL
# =========================================================

@router.get("/calculate")
def calculate_payroll(
    employee_id: int,
    pay_period: str,
    overtime: Decimal = Decimal("0")
):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            e.employee_id,
            p.basic_salary
        FROM "EmployeeRecords" e

        LEFT JOIN "Position" p
            ON e.position_id = p.position_id

        WHERE e.employee_id = %s
    """, (employee_id,))

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    # Monthly salary from Position
    monthly_basic_salary = money(
        row[1] or 0
    )

    # =====================================================
    # SEMI-MONTHLY BASIC SALARY
    # =====================================================

    semi_monthly_basic_salary = money(
        monthly_basic_salary /
        Decimal("2")
    )

    overtime_amount = money(
        overtime
    )

    # =====================================================
    # ATTENDANCE
    # =====================================================

    attendance = calculate_attendance(
        employee_id,
        pay_period,
        monthly_basic_salary
    )

    attendance_deduction = money(
        attendance["attendance_deduction"]
    )

    # =====================================================
    # GROSS SALARY
    # =====================================================

    gross_salary = money(
        semi_monthly_basic_salary
        + overtime_amount
        - attendance_deduction
    )

    # =====================================================
    # CONTRIBUTIONS
    # =====================================================

    sss = calculate_sss(
        monthly_basic_salary
    )

    philhealth = calculate_philhealth(
        monthly_basic_salary
    )

    pagibig = calculate_pagibig(
        monthly_basic_salary
    )

    # =====================================================
    # 13TH MONTH PAY
    # =====================================================

    thirteenth_month_pay = money(
        semi_monthly_basic_salary /
        Decimal("12")
    )

    # =====================================================
    # NET SALARY
    # =====================================================

    net_salary = money(
        gross_salary
        - sss
        - philhealth
        - pagibig
    )

    return {

        "employee_id":
            employee_id,

        "pay_period":
            pay_period,

        "monthly_basic_salary":
            monthly_basic_salary,

        "semi_monthly_basic_salary":
            semi_monthly_basic_salary,

        "overtime":
            overtime_amount,

        "present_days":
            attendance[
                "present_days"
            ],

        "late_days":
            attendance[
                "late_days"
            ],

        "absent_days":
            attendance[
                "absent_days"
            ],

        "leave_days":
            attendance[
                "leave_days"
            ],

        "late_converted_absences":
            attendance[
                "late_converted_absences"
            ],

        "remaining_late_days":
            attendance[
                "remaining_late_days"
            ],

        "total_absences":
            attendance[
                "total_absences"
            ],

        "daily_rate":
            attendance[
                "daily_rate"
            ],

        "attendance_deduction":
            attendance[
                "attendance_deduction"
            ],

        "gross_salary":
            gross_salary,

        "sss":
            sss,

        "philhealth":
            philhealth,

        "pag_ibig":
            pagibig,

        "thirteenth_month_pay":
            thirteenth_month_pay,

        "net_salary":
            net_salary
    }


# =========================================================
# GET ALL PAYROLL
# =========================================================

@router.get("/")
def get_payroll():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            p.payroll_id,
            p.employee_id,

            e.first_name || ' ' || e.last_name
                AS employee_name,

            pos.basic_salary,

            p.pay_period,
            p.overtime,
            p.gross_salary,
            p.sss,
            p.philhealth,
            p.pag_ibig,
            p.deductions,
            p.net_salary,
            p."13th_month_pay",
            p.payroll_status,
            p.payment_date

        FROM "Payroll" p

        LEFT JOIN "EmployeeRecords" e
            ON p.employee_id = e.employee_id

        LEFT JOIN "Position" pos
            ON e.position_id = pos.position_id

        ORDER BY p.payroll_id DESC
    """)

    rows = cursor.fetchall()

    columns = [
        desc[0]
        for desc in cursor.description
    ]

    result = [
        dict(zip(columns, row))
        for row in rows
    ]

    cursor.close()
    conn.close()

    return result


# =========================================================
# GET ONE PAYROLL
# =========================================================

@router.get("/{payroll_id}")
def get_payroll_by_id(
    payroll_id: int
):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            p.payroll_id,
            p.employee_id,

            e.first_name || ' ' || e.last_name
                AS employee_name,

            pos.basic_salary,

            p.pay_period,
            p.overtime,
            p.gross_salary,
            p.sss,
            p.philhealth,
            p.pag_ibig,
            p.deductions,
            p.net_salary,
            p."13th_month_pay",
            p.payroll_status,
            p.payment_date

        FROM "Payroll" p

        LEFT JOIN "EmployeeRecords" e
            ON p.employee_id = e.employee_id

        LEFT JOIN "Position" pos
            ON e.position_id = pos.position_id

        WHERE p.payroll_id = %s
    """, (payroll_id,))

    row = cursor.fetchone()

    if not row:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Payroll record not found"
        )

    columns = [
        desc[0]
        for desc in cursor.description
    ]

    result = dict(zip(columns, row))

    cursor.close()
    conn.close()

    return result


# =========================================================
# CREATE PAYROLL
# =========================================================

@router.post("/")
def create_payroll(
    payroll: PayrollCreate
):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            e.employee_id,
            p.basic_salary
        FROM "EmployeeRecords" e

        LEFT JOIN "Position" p
            ON e.position_id = p.position_id

        WHERE e.employee_id = %s
    """, (payroll.employee_id,))

    employee = cursor.fetchone()

    if not employee:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    # Monthly salary from Position
    monthly_basic_salary = money(
        employee[1] or 0
    )

    # Semi-monthly salary
    semi_monthly_basic_salary = money(
        monthly_basic_salary /
        Decimal("2")
    )

    overtime_amount = money(
        payroll.overtime
    )

    # =====================================================
    # ATTENDANCE
    # =====================================================

    attendance = calculate_attendance(
        payroll.employee_id,
        payroll.pay_period,
        monthly_basic_salary
    )

    attendance_deduction = money(
        attendance["attendance_deduction"]
    )

    # =====================================================
    # GROSS SALARY
    # =====================================================

    gross_salary = money(
        semi_monthly_basic_salary
        + overtime_amount
        - attendance_deduction
    )

    # =====================================================
    # CONTRIBUTIONS
    # =====================================================

    calculated_sss = calculate_sss(
        monthly_basic_salary
    )

    calculated_philhealth = (
        calculate_philhealth(
            monthly_basic_salary
        )
    )

    calculated_pagibig = (
        calculate_pagibig(
            monthly_basic_salary
        )
    )

    other_deductions = money(
        payroll.deductions
    )

    # =====================================================
    # 13TH MONTH PAY
    # =====================================================

    calculated_thirteenth_month_pay = money(
        semi_monthly_basic_salary /
        Decimal("12")
    )

    # =====================================================
    # NET SALARY
    # =====================================================

    calculated_net_salary = money(
        gross_salary
        - calculated_sss
        - calculated_philhealth
        - calculated_pagibig
        - other_deductions
    )

    # =====================================================
    # INSERT PAYROLL
    # =====================================================

    cursor.execute("""
        INSERT INTO "Payroll" (
            employee_id,
            pay_period,
            overtime,
            gross_salary,
            sss,
            philhealth,
            pag_ibig,
            deductions,
            net_salary,
            "13th_month_pay",
            payroll_status,
            payment_date
        )

        VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s
        )

        RETURNING payroll_id
    """, (
        payroll.employee_id,
        payroll.pay_period,
        overtime_amount,
        gross_salary,
        calculated_sss,
        calculated_philhealth,
        calculated_pagibig,
        other_deductions,
        calculated_net_salary,
        calculated_thirteenth_month_pay,
        payroll.payroll_status,
        payroll.payment_date
    ))

    payroll_id = cursor.fetchone()[0]

    # =====================================================
    # PUSH PENDING PAYROLL TO FINANCE
    # =====================================================

    sync_pending_payroll_to_finance(
        cursor,
        payroll_id,
        calculated_net_salary,
        payroll.payroll_status
    )

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message":
            "Payroll record created successfully",

        "payroll_id":
            payroll_id,

        "monthly_basic_salary":
            monthly_basic_salary,

        "semi_monthly_basic_salary":
            semi_monthly_basic_salary,

        "present_days":
            attendance["present_days"],

        "late_days":
            attendance["late_days"],

        "absent_days":
            attendance["absent_days"],

        "late_converted_absences":
            attendance[
                "late_converted_absences"
            ],

        "total_absences":
            attendance[
                "total_absences"
            ],

        "attendance_deduction":
            attendance[
                "attendance_deduction"
            ],

        "gross_salary":
            gross_salary,

        "sss":
            calculated_sss,

        "philhealth":
            calculated_philhealth,

        "pag_ibig":
            calculated_pagibig,

        "thirteenth_month_pay":
            calculated_thirteenth_month_pay,

        "net_salary":
            calculated_net_salary
    }


# =========================================================
# UPDATE PAYROLL
# =========================================================

@router.put("/{payroll_id}")
def update_payroll(
    payroll_id: int,
    payroll: PayrollUpdate
):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT payroll_id
        FROM "Payroll"
        WHERE payroll_id = %s
    """, (payroll_id,))

    existing = cursor.fetchone()

    if not existing:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Payroll record not found"
        )

    cursor.execute("""
        SELECT
            p.basic_salary
        FROM "EmployeeRecords" e

        LEFT JOIN "Position" p
            ON e.position_id = p.position_id

        WHERE e.employee_id = %s
    """, (payroll.employee_id,))

    employee = cursor.fetchone()

    if not employee:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    # Monthly salary
    monthly_basic_salary = money(
        employee[0] or 0
    )

    # Semi-monthly salary
    semi_monthly_basic_salary = money(
        monthly_basic_salary /
        Decimal("2")
    )

    overtime_amount = money(
        payroll.overtime
    )

    # =====================================================
    # ATTENDANCE
    # =====================================================

    attendance = calculate_attendance(
        payroll.employee_id,
        payroll.pay_period,
        monthly_basic_salary
    )

    attendance_deduction = money(
        attendance["attendance_deduction"]
    )

    # =====================================================
    # GROSS SALARY
    # =====================================================

    gross_salary = money(
        semi_monthly_basic_salary
        + overtime_amount
        - attendance_deduction
    )

    # =====================================================
    # CONTRIBUTIONS
    # =====================================================

    calculated_sss = calculate_sss(
        monthly_basic_salary
    )

    calculated_philhealth = (
        calculate_philhealth(
            monthly_basic_salary
        )
    )

    calculated_pagibig = (
        calculate_pagibig(
            monthly_basic_salary
        )
    )

    other_deductions = money(
        payroll.deductions
    )

    # =====================================================
    # 13TH MONTH PAY
    # =====================================================

    calculated_thirteenth_month_pay = money(
        semi_monthly_basic_salary /
        Decimal("12")
    )

    # =====================================================
    # NET SALARY
    # =====================================================

    calculated_net_salary = money(
        gross_salary
        - calculated_sss
        - calculated_philhealth
        - calculated_pagibig
        - other_deductions
    )

    # =====================================================
    # UPDATE PAYROLL
    # =====================================================

    cursor.execute("""
        UPDATE "Payroll"

        SET
            employee_id = %s,
            pay_period = %s,
            overtime = %s,
            gross_salary = %s,
            sss = %s,
            philhealth = %s,
            pag_ibig = %s,
            deductions = %s,
            net_salary = %s,
            "13th_month_pay" = %s,
            payroll_status = %s,
            payment_date = %s

        WHERE payroll_id = %s
    """, (
        payroll.employee_id,
        payroll.pay_period,
        overtime_amount,
        gross_salary,
        calculated_sss,
        calculated_philhealth,
        calculated_pagibig,
        other_deductions,
        calculated_net_salary,
        calculated_thirteenth_month_pay,
        payroll.payroll_status,
        payroll.payment_date,
        payroll_id
    ))

    # =====================================================
    # UPDATE FINANCE PAYROLL EXPENSE
    # =====================================================

    sync_pending_payroll_to_finance(
        cursor,
        payroll_id,
        calculated_net_salary,
        payroll.payroll_status
    )

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message":
            "Payroll record updated successfully",

        "monthly_basic_salary":
            monthly_basic_salary,

        "semi_monthly_basic_salary":
            semi_monthly_basic_salary,

        "present_days":
            attendance["present_days"],

        "late_days":
            attendance["late_days"],

        "absent_days":
            attendance["absent_days"],

        "late_converted_absences":
            attendance[
                "late_converted_absences"
            ],

        "total_absences":
            attendance[
                "total_absences"
            ],

        "attendance_deduction":
            attendance[
                "attendance_deduction"
            ],

        "gross_salary":
            gross_salary,

        "sss":
            calculated_sss,

        "philhealth":
            calculated_philhealth,

        "pag_ibig":
            calculated_pagibig,

        "thirteenth_month_pay":
            calculated_thirteenth_month_pay,

        "net_salary":
            calculated_net_salary
    }


# =========================================================
# DELETE PAYROLL
# =========================================================

@router.delete("/{payroll_id}")
def delete_payroll(
    payroll_id: int
):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT payroll_id
        FROM "Payroll"
        WHERE payroll_id = %s
    """, (payroll_id,))

    existing = cursor.fetchone()

    if not existing:
        cursor.close()
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Payroll record not found"
        )

    cursor.execute("""
        DELETE FROM "Payroll"
        WHERE payroll_id = %s
    """, (payroll_id,))

    conn.commit()

    cursor.close()
    conn.close()

    return {
        "message":
            "Payroll record deleted successfully"
    }