from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from database import get_db_connection
import calendar
import re

router = APIRouter(
    prefix="/payroll",
    tags=["Payroll"]
)


# =========================================================
# GOVERNMENT CONTRIBUTIONS
# =========================================================

def calculate_sss(monthly_salary: float):
    msc = max(5000, min(monthly_salary, 35000))
    monthly_employee_share = msc * 0.05
    return monthly_employee_share / 2


def calculate_philhealth(monthly_salary: float):
    monthly_salary = max(10000, min(monthly_salary, 100000))
    total_monthly_contribution = monthly_salary * 0.05
    employee_monthly_share = total_monthly_contribution / 2
    return employee_monthly_share / 2


def calculate_pagibig(monthly_salary: float):
    base_salary = min(monthly_salary, 10000)
    monthly_employee_share = base_salary * 0.02
    return monthly_employee_share / 2


# =========================================================
# PAY PERIOD
# =========================================================

def parse_pay_period(pay_period: str):
    """
    Supports:
        November 1-15, 2026
        November 16-30, 2026
        November 16-17, 2026
        November 10-20, 2026
        November 17-19, 2026
    """

    match = re.match(
        r"^([A-Za-z]+)\s+(\d+)-(\d+),\s+(\d{4})$",
        pay_period.strip()
    )

    if not match:
        raise ValueError(
            "Invalid pay period format. "
            "Use 'November 1-15, 2026' or "
            "'November 16-30, 2026'."
        )

    month_name = match.group(1)
    start_day = int(match.group(2))
    end_day = int(match.group(3))
    year = int(match.group(4))

    # Case-insensitive month matching
    month = None

    for index, name in enumerate(calendar.month_name):
        if name.lower() == month_name.lower():
            month = index
            break

    if month is None:
        raise ValueError("Invalid month name.")

    try:
        start_date = datetime(
            year,
            month,
            start_day
        ).date()

        end_date = datetime(
            year,
            month,
            end_day
        ).date()

    except ValueError:
        raise ValueError("Invalid date in pay period.")

    if end_date < start_date:
        raise ValueError(
            "Pay period end date cannot be earlier than start date."
        )

    return start_date, end_date


# =========================================================
# ATTENDANCE CALCULATION
# =========================================================

def calculate_attendance(
    employee_id: int,
    pay_period: str,
    monthly_basic_salary: float
):
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        start_date, end_date = parse_pay_period(pay_period)

        cur.execute(
            """
            SELECT status
            FROM "Attendance"
            WHERE employee_id = %s
              AND date BETWEEN %s AND %s
            ORDER BY date
            """,
            (
                employee_id,
                start_date,
                end_date
            )
        )

        rows = cur.fetchall()

        present_days = 0
        late_days = 0
        absent_days = 0
        leave_days = 0

        for row in rows:
            status = row[0]

            if status == "Present":
                present_days += 1

            elif status == "Late":
                late_days += 1

            elif status == "Absent":
                absent_days += 1

            elif status == "Leave":
                leave_days += 1

        # Every 3 late days = 1 additional absence
        late_converted_absences = late_days // 3

        remaining_late_days = late_days % 3

        total_absences = (
            absent_days +
            late_converted_absences
        )

        # Daily rate is based on the 26-day payroll divisor
        daily_rate = monthly_basic_salary / 26

        # Attendance deduction
        attendance_deduction = (
            daily_rate * total_absences
        )

        # Number of calendar days in selected period
        period_days = (
            end_date - start_date
        ).days + 1

        return {
            "start_date": start_date,
            "end_date": end_date,
            "period_days": period_days,

            "present_days": present_days,
            "late_days": late_days,
            "absent_days": absent_days,
            "leave_days": leave_days,

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

    finally:
        cur.close()
        conn.close()


# =========================================================
# PAYROLL CALCULATION
# =========================================================

def calculate_payroll_values(
    employee_id: int,
    pay_period: str,
    overtime: float = 0,
    other_deductions: float = 0
):
    conn = get_db_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # GET EMPLOYEE SALARY
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                e.employee_id,
                pos.basic_salary
            FROM "EmployeeRecords" e
            LEFT JOIN "Position" pos
                ON e.position_id = pos.position_id
            WHERE e.employee_id = %s
            """,
            (employee_id,)
        )

        employee = cur.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found."
            )

        monthly_basic_salary = float(
            employee[1] or 0
        )

        # -------------------------------------------------
        # ATTENDANCE
        # -------------------------------------------------

        attendance = calculate_attendance(
            employee_id,
            pay_period,
            monthly_basic_salary
        )

        period_days = attendance["period_days"]

        daily_rate = (
            monthly_basic_salary / 26
        )

        # -------------------------------------------------
        # BASIC SALARY FOR SELECTED PERIOD
        # -------------------------------------------------

        period_basic_salary = (
            daily_rate * period_days
        )

        # -------------------------------------------------
        # ATTENDANCE DEDUCTION
        # -------------------------------------------------

        attendance_deduction = (
            attendance["attendance_deduction"]
        )

        # -------------------------------------------------
        # OVERTIME
        # -------------------------------------------------

        overtime_amount = float(
            overtime or 0
        )

        # Prevent negative overtime
        overtime_amount = max(
            0,
            overtime_amount
        )

        # -------------------------------------------------
        # OTHER DEDUCTIONS
        # -------------------------------------------------

        other_deductions_amount = float(
            other_deductions or 0
        )

        # Prevent negative deductions
        other_deductions_amount = max(
            0,
            other_deductions_amount
        )

        # -------------------------------------------------
        # GROSS SALARY
        # -------------------------------------------------

        gross_salary = (
            period_basic_salary
            + overtime_amount
            - attendance_deduction
        )

        gross_salary = max(
            0,
            gross_salary
        )

        # -------------------------------------------------
        # GOVERNMENT CONTRIBUTIONS
        # -------------------------------------------------

        sss = calculate_sss(
            monthly_basic_salary
        )

        philhealth = calculate_philhealth(
            monthly_basic_salary
        )

        pag_ibig = calculate_pagibig(
            monthly_basic_salary
        )

        # -------------------------------------------------
        # 13TH MONTH PAY
        # -------------------------------------------------

        thirteenth_month_pay = (
            period_basic_salary / 12
        )

        # -------------------------------------------------
        # NET SALARY
        # -------------------------------------------------

        net_salary = (
            gross_salary
            - sss
            - philhealth
            - pag_ibig
            - other_deductions_amount
        )

        net_salary = max(
            0,
            net_salary
        )

        return {
            "monthly_basic_salary":
                monthly_basic_salary,

            "period_basic_salary":
                period_basic_salary,

            "semi_monthly_salary":
                monthly_basic_salary / 2,

            "period_days":
                period_days,

            "gross_salary":
                gross_salary,

            "sss":
                sss,

            "philhealth":
                philhealth,

            "pag_ibig":
                pag_ibig,

            "deductions":
                other_deductions_amount,

            "net_salary":
                net_salary,

            "thirteenth_month_pay":
                thirteenth_month_pay,

            "overtime":
                overtime_amount,

            **attendance
        }

    finally:
        cur.close()
        conn.close()


# =========================================================
# FINANCE SYNC
# =========================================================

def sync_pending_payroll_to_finance(
    cursor,
    payroll_id: int,
    amount: float,
    payroll_status: str
):

    # Only Pending payroll should be sent to Finance
    if payroll_status != "Pending":
        return

    cursor.execute(
        """
        SELECT "payrollExpenseID"
        FROM "PayrollExpense"
        WHERE payroll_id = %s
        LIMIT 1
        """,
        (payroll_id,)
    )

    existing = cursor.fetchone()

    if existing:

        cursor.execute(
            """
            UPDATE "PayrollExpense"
            SET amount = %s
            WHERE payroll_id = %s
            """,
            (
                amount,
                payroll_id
            )
        )

    else:

        cursor.execute(
            """
            INSERT INTO "PayrollExpense" (
                payroll_id,
                amount
            )
            VALUES (%s, %s)
            """,
            (
                payroll_id,
                amount
            )
        )


# =========================================================
# MODELS
# =========================================================

class PayrollCreate(BaseModel):
    employee_id: int
    pay_period: str
    overtime: float = 0
    gross_salary: float = 0
    sss: float = 0
    philhealth: float = 0
    pag_ibig: float = 0
    deductions: float = 0
    net_salary: float = 0
    thirteenth_month_pay: float = 0
    payroll_status: str = "Pending"
    payment_date: str | None = None


class PayrollUpdate(BaseModel):
    employee_id: int
    pay_period: str
    overtime: float = 0
    gross_salary: float = 0
    sss: float = 0
    philhealth: float = 0
    pag_ibig: float = 0
    deductions: float = 0
    net_salary: float = 0
    thirteenth_month_pay: float = 0
    payroll_status: str = "Pending"
    payment_date: str | None = None


# =========================================================
# CALCULATE
# =========================================================

@router.get("/calculate")
def calculate_payroll(
    employee_id: int,
    pay_period: str,
    overtime: float = 0,
    deductions: float = 0
):

    try:

        result = calculate_payroll_values(
            employee_id,
            pay_period,
            overtime,
            deductions
        )

        return {
            "employee_id":
                employee_id,

            "pay_period":
                pay_period,

            "basic_salary":
                result["monthly_basic_salary"],

            "period_basic_salary":
                result["period_basic_salary"],

            "semi_monthly_salary":
                result["semi_monthly_salary"],

            "period_days":
                result["period_days"],

            "present_days":
                result["present_days"],

            "absent_days":
                result["total_absences"],

            "late_days":
                result["late_days"],

            "leave_days":
                result["leave_days"],

            "late_converted_absences":
                result["late_converted_absences"],

            "remaining_late_days":
                result["remaining_late_days"],

            "daily_rate":
                result["daily_rate"],

            "attendance_deduction":
                result["attendance_deduction"],

            "overtime":
                result["overtime"],

            "gross_salary":
                result["gross_salary"],

            "sss":
                result["sss"],

            "philhealth":
                result["philhealth"],

            "pag_ibig":
                result["pag_ibig"],

            "deductions":
                result["deductions"],

            "thirteenth_month_pay":
                result["thirteenth_month_pay"],

            "net_salary":
                result["net_salary"]
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# GET ALL PAYROLL
# =========================================================

@router.get("/")
def get_payroll():

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        cur.execute(
            """
            SELECT
                p.payroll_id,
                p.employee_id,
                e.first_name || ' ' || e.last_name AS employee_name,
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
            """
        )

        rows = cur.fetchall()

        payroll = []

        for row in rows:

            payroll_id = row[0]
            employee_id = row[1]
            employee_name = row[2]

            basic_salary = float(
                row[3] or 0
            )

            pay_period = row[4]

            overtime = float(
                row[5] or 0
            )

            stored_deductions = float(
                row[10] or 0
            )

            payroll_status = row[13]

            # Recalculate attendance for the selected period
            attendance = calculate_attendance(
                employee_id,
                pay_period,
                basic_salary
            )

            period_basic_salary = (
                attendance["daily_rate"]
                * attendance["period_days"]
            )

            # -------------------------------------------------
            # GROSS
            # -------------------------------------------------

            gross_salary = (
                period_basic_salary
                + overtime
                - attendance["attendance_deduction"]
            )

            gross_salary = max(
                0,
                gross_salary
            )

            # -------------------------------------------------
            # GOVERNMENT CONTRIBUTIONS
            # -------------------------------------------------

            sss = calculate_sss(
                basic_salary
            )

            philhealth = calculate_philhealth(
                basic_salary
            )

            pag_ibig = calculate_pagibig(
                basic_salary
            )

            # -------------------------------------------------
            # 13TH MONTH
            # -------------------------------------------------

            thirteenth_month_pay = (
                period_basic_salary / 12
            )

            # -------------------------------------------------
            # NET
            # -------------------------------------------------

            net_salary = (
                gross_salary
                - sss
                - philhealth
                - pag_ibig
                - stored_deductions
            )

            net_salary = max(
                0,
                net_salary
            )

            payroll.append({

                "payroll_id":
                    payroll_id,

                "employee_id":
                    employee_id,

                "employee_name":
                    employee_name,

                "basic_salary":
                    basic_salary,

                "period_basic_salary":
                    period_basic_salary,

                "pay_period":
                    pay_period,

                "overtime":
                    overtime,

                "gross_salary":
                    gross_salary,

                "sss":
                    sss,

                "philhealth":
                    philhealth,

                "pag_ibig":
                    pag_ibig,

                "deductions":
                    stored_deductions,

                "net_salary":
                    net_salary,

                "13th_month_pay":
                    thirteenth_month_pay,

                "payroll_status":
                    payroll_status,

                "payment_date":
                    row[14],

                "period_days":
                    attendance["period_days"],

                "present_days":
                    attendance["present_days"],

                "absent_days":
                    attendance["total_absences"],

                "late_days":
                    attendance["late_days"],

                "leave_days":
                    attendance["leave_days"],

                "late_converted_absences":
                    attendance["late_converted_absences"],

                "remaining_late_days":
                    attendance["remaining_late_days"],

                "daily_rate":
                    attendance["daily_rate"],

                "attendance_deduction":
                    attendance["attendance_deduction"]
            })

        return payroll

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# GET SINGLE PAYROLL
# =========================================================

@router.get("/{payroll_id}")
def get_single_payroll(payroll_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        cur.execute(
            """
            SELECT
                p.payroll_id,
                p.employee_id,
                e.first_name || ' ' || e.last_name AS employee_name,
                pos.basic_salary,
                p.pay_period,
                p.overtime,
                p.deductions,
                p.payroll_status,
                p.payment_date
            FROM "Payroll" p
            LEFT JOIN "EmployeeRecords" e
                ON p.employee_id = e.employee_id
            LEFT JOIN "Position" pos
                ON e.position_id = pos.position_id
            WHERE p.payroll_id = %s
            """,
            (payroll_id,)
        )

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Payroll record not found."
            )

        employee_id = row[1]

        basic_salary = float(
            row[3] or 0
        )

        pay_period = row[4]

        overtime = float(
            row[5] or 0
        )

        deductions = float(
            row[6] or 0
        )

        result = calculate_payroll_values(
            employee_id,
            pay_period,
            overtime,
            deductions
        )

        return {

            "payroll_id":
                row[0],

            "employee_id":
                employee_id,

            "employee_name":
                row[2],

            "basic_salary":
                basic_salary,

            "period_basic_salary":
                result["period_basic_salary"],

            "pay_period":
                pay_period,

            "period_days":
                result["period_days"],

            "overtime":
                result["overtime"],

            "gross_salary":
                result["gross_salary"],

            "sss":
                result["sss"],

            "philhealth":
                result["philhealth"],

            "pag_ibig":
                result["pag_ibig"],

            "deductions":
                result["deductions"],

            "net_salary":
                result["net_salary"],

            "13th_month_pay":
                result["thirteenth_month_pay"],

            "payroll_status":
                row[7],

            "payment_date":
                row[8],

            "present_days":
                result["present_days"],

            "absent_days":
                result["total_absences"],

            "late_days":
                result["late_days"],

            "leave_days":
                result["leave_days"],

            "late_converted_absences":
                result["late_converted_absences"],

            "remaining_late_days":
                result["remaining_late_days"],

            "daily_rate":
                result["daily_rate"],

            "attendance_deduction":
                result["attendance_deduction"]
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# CREATE PAYROLL
# =========================================================

@router.post("/")
def create_payroll(data: PayrollCreate):

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        result = calculate_payroll_values(
            data.employee_id,
            data.pay_period,
            data.overtime,
            data.deductions
        )

        cur.execute(
            """
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
            """,
            (
                data.employee_id,
                data.pay_period,
                result["overtime"],
                result["gross_salary"],
                result["sss"],
                result["philhealth"],
                result["pag_ibig"],
                result["deductions"],
                result["net_salary"],
                result["thirteenth_month_pay"],
                data.payroll_status,
                data.payment_date
            )
        )

        payroll_id = cur.fetchone()[0]

        sync_pending_payroll_to_finance(
            cur,
            payroll_id,
            result["net_salary"],
            data.payroll_status
        )

        conn.commit()

        return {
            "message":
                "Payroll created successfully.",

            "payroll_id":
                payroll_id
        }

    except HTTPException:

        conn.rollback()
        raise

    except Exception as e:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# UPDATE PAYROLL
# =========================================================

@router.put("/{payroll_id}")
def update_payroll(
    payroll_id: int,
    data: PayrollUpdate
):

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        cur.execute(
            """
            SELECT payroll_id
            FROM "Payroll"
            WHERE payroll_id = %s
            """,
            (payroll_id,)
        )

        if not cur.fetchone():

            raise HTTPException(
                status_code=404,
                detail="Payroll record not found."
            )

        result = calculate_payroll_values(
            data.employee_id,
            data.pay_period,
            data.overtime,
            data.deductions
        )

        cur.execute(
            """
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
            """,
            (
                data.employee_id,
                data.pay_period,
                result["overtime"],
                result["gross_salary"],
                result["sss"],
                result["philhealth"],
                result["pag_ibig"],
                result["deductions"],
                result["net_salary"],
                result["thirteenth_month_pay"],
                data.payroll_status,
                data.payment_date,
                payroll_id
            )
        )

        sync_pending_payroll_to_finance(
            cur,
            payroll_id,
            result["net_salary"],
            data.payroll_status
        )

        conn.commit()

        return {
            "message":
                "Payroll updated successfully."
        }

    except HTTPException:

        conn.rollback()
        raise

    except Exception as e:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# DELETE PAYROLL
# =========================================================

@router.delete("/{payroll_id}")
def delete_payroll(payroll_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        # Remove related Finance expense first
        cur.execute(
            """
            DELETE FROM "PayrollExpense"
            WHERE payroll_id = %s
            """,
            (payroll_id,)
        )

        # Then remove payroll
        cur.execute(
            """
            DELETE FROM "Payroll"
            WHERE payroll_id = %s
            """,
            (payroll_id,)
        )

        if cur.rowcount == 0:

            raise HTTPException(
                status_code=404,
                detail="Payroll record not found."
            )

        conn.commit()

        return {
            "message":
                "Payroll deleted successfully."
        }

    except HTTPException:

        conn.rollback()
        raise

    except Exception as e:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()