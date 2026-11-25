"use client";

import { useEffect, useState } from "react";
import HRISSidebar from "@/components/HRISSidebar";
import "./reports.css";

const API = "http://127.0.0.1:8000";

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  employment_status?: string;
};

type Attendance = {
  attendance_id: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};

type LeaveRecord = {
  leave_id: number;
  employee_id: number;
  employee_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
};

type Payroll = {
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  basic_salary: number;
  pay_period: string;
  overtime: number;
  gross_salary: number;
  sss: number;
  philhealth: number;
  pag_ibig: number;
  deductions: number;
  net_salary: number;
  payroll_status: string;
  payment_date: string | null;
};

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const [
        employeesResponse,
        attendanceResponse,
        leaveResponse,
        payrollResponse,
      ] = await Promise.all([
        fetch(`${API}/employees/`),
        fetch(`${API}/attendance/`),
        fetch(`${API}/leave/`),
        fetch(`${API}/payroll/`),
      ]);

      if (
        !employeesResponse.ok ||
        !attendanceResponse.ok ||
        !leaveResponse.ok ||
        !payrollResponse.ok
      ) {
        throw new Error("Failed to load report data.");
      }

      const [
        employeesData,
        attendanceData,
        leaveData,
        payrollData,
      ] = await Promise.all([
        employeesResponse.json(),
        attendanceResponse.json(),
        leaveResponse.json(),
        payrollResponse.json(),
      ]);

      setEmployees(employeesData);
      setAttendance(attendanceData);
      setLeaveRecords(leaveData);
      setPayroll(payrollData);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     EMPLOYEE SUMMARY
  ========================= */

  const totalEmployees = employees.length;

  const activeEmployees = employees.filter(
    (employee) =>
      employee.employment_status?.toLowerCase() === "active"
  ).length;

  const onLeaveEmployees = employees.filter(
    (employee) =>
      employee.employment_status?.toLowerCase() === "on leave" ||
      employee.employment_status?.toLowerCase() === "leave"
  ).length;

  const inactiveEmployees = employees.filter(
    (employee) =>
      employee.employment_status?.toLowerCase() === "inactive"
  ).length;

  /* =========================
     ATTENDANCE SUMMARY
  ========================= */

  const presentDays = attendance.filter(
    (record) =>
      record.status?.toLowerCase() === "present"
  ).length;

  const absentDays = attendance.filter(
    (record) =>
      record.status?.toLowerCase() === "absent"
  ).length;

  const lateDays = attendance.filter(
    (record) =>
      record.status?.toLowerCase() === "late"
  ).length;

  const totalAttendanceRecords = attendance.length;

  const attendanceRate =
    totalAttendanceRecords > 0
      ? ((presentDays / totalAttendanceRecords) * 100).toFixed(1)
      : "0.0";

  /* =========================
     LEAVE SUMMARY
  ========================= */

  const totalLeaveRequests = leaveRecords.length;

  const pendingLeaves = leaveRecords.filter(
    (record) =>
      record.status?.toLowerCase() === "pending"
  ).length;

  const approvedLeaves = leaveRecords.filter(
    (record) =>
      record.status?.toLowerCase() === "approved"
  ).length;

  const rejectedLeaves = leaveRecords.filter(
    (record) =>
      record.status?.toLowerCase() === "rejected"
  ).length;

  /* =========================
     PAYROLL SUMMARY
  ========================= */

  const totalPayrollRecords = payroll.length;

  const pendingPayroll = payroll.filter(
    (record) =>
      record.payroll_status?.toLowerCase() === "pending"
  ).length;

  const processedPayroll = payroll.filter(
    (record) =>
      record.payroll_status?.toLowerCase() === "processed"
  ).length;

  const paidPayroll = payroll.filter(
    (record) =>
      record.payroll_status?.toLowerCase() === "paid"
  ).length;

  const totalNetPayroll = payroll.reduce(
    (total, record) =>
      total + Number(record.net_salary || 0),
    0
  );

  const totalGrossPayroll = payroll.reduce(
    (total, record) =>
      total + Number(record.gross_salary || 0),
    0
  );

  const formatCurrency = (value: number) => {
    return `₱${Number(value || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString(
      "en-PH"
    );
  };

  return (
    <div className="hr-layout">

      {/* =========================
          SHARED HRIS SIDEBAR
      ========================= */}

      <HRISSidebar />

      {/* =========================
          MAIN CONTENT
      ========================= */}

      <main className="main-content">

        <div className="page-header">

          <div>

            <h1>
              Reports
            </h1>

            <p>
              View summaries of employees,
              attendance, leave, and payroll.
            </p>

          </div>

          <div className="current-date">
            {currentDate}
          </div>

        </div>

        {loading ? (

          <div className="loading-card">
            Loading reports...
          </div>

        ) : (

          <>

            {/* =========================
                EMPLOYEE SUMMARY
            ========================= */}

            <div className="section-title">
              <h2>
                Employee Summary
              </h2>

              <p>
                Overview of employee records.
              </p>
            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div>
                  <p>
                    Total Employees
                  </p>

                  <h2>
                    {totalEmployees}
                  </h2>
                </div>

                <div className="stat-icon">
                  👥
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Active Employees
                  </p>

                  <h2>
                    {activeEmployees}
                  </h2>
                </div>

                <div className="stat-icon">
                  ✓
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    On Leave
                  </p>

                  <h2>
                    {onLeaveEmployees}
                  </h2>
                </div>

                <div className="stat-icon">
                  📅
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Inactive
                  </p>

                  <h2>
                    {inactiveEmployees}
                  </h2>
                </div>

                <div className="stat-icon">
                  ⏸
                </div>

              </div>

            </div>

            {/* =========================
                ATTENDANCE SUMMARY
            ========================= */}

            <div className="section-title">

              <h2>
                Attendance Summary
              </h2>

              <p>
                Summary of employee attendance
                records.
              </p>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div>
                  <p>
                    Present Days
                  </p>

                  <h2>
                    {presentDays}
                  </h2>
                </div>

                <div className="stat-icon">
                  ✓
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Absent Days
                  </p>

                  <h2>
                    {absentDays}
                  </h2>
                </div>

                <div className="stat-icon">
                  !
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Late Days
                  </p>

                  <h2>
                    {lateDays}
                  </h2>
                </div>

                <div className="stat-icon">
                  🕐
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Attendance Rate
                  </p>

                  <h2>
                    {attendanceRate}%
                  </h2>
                </div>

                <div className="stat-icon">
                  📈
                </div>

              </div>

            </div>

            {/* =========================
                LEAVE SUMMARY
            ========================= */}

            <div className="section-title">

              <h2>
                Leave Summary
              </h2>

              <p>
                Overview of employee leave
                requests.
              </p>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div>
                  <p>
                    Total Requests
                  </p>

                  <h2>
                    {totalLeaveRequests}
                  </h2>
                </div>

                <div className="stat-icon">
                  📅
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Pending
                  </p>

                  <h2>
                    {pendingLeaves}
                  </h2>
                </div>

                <div className="stat-icon">
                  ⏳
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Approved
                  </p>

                  <h2>
                    {approvedLeaves}
                  </h2>
                </div>

                <div className="stat-icon">
                  ✓
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Rejected
                  </p>

                  <h2>
                    {rejectedLeaves}
                  </h2>
                </div>

                <div className="stat-icon">
                  ✕
                </div>

              </div>

            </div>

            {/* =========================
                PAYROLL SUMMARY
            ========================= */}

            <div className="section-title">

              <h2>
                Payroll Summary
              </h2>

              <p>
                Overview of employee payroll
                records and salary totals.
              </p>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div>
                  <p>
                    Payroll Records
                  </p>

                  <h2>
                    {totalPayrollRecords}
                  </h2>
                </div>

                <div className="stat-icon">
                  💰
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Pending Payroll
                  </p>

                  <h2>
                    {pendingPayroll}
                  </h2>
                </div>

                <div className="stat-icon">
                  ⏳
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Processed
                  </p>

                  <h2>
                    {processedPayroll}
                  </h2>
                </div>

                <div className="stat-icon">
                  ✓
                </div>

              </div>

              <div className="stat-card">

                <div>
                  <p>
                    Paid
                  </p>

                  <h2>
                    {paidPayroll}
                  </h2>
                </div>

                <div className="stat-icon">
                  💵
                </div>

              </div>

            </div>

            {/* =========================
                PAYROLL TOTALS
            ========================= */}

            <div className="summary-card">

              <div className="summary-item">

                <span>
                  Total Gross Payroll
                </span>

                <strong>
                  {formatCurrency(
                    totalGrossPayroll
                  )}
                </strong>

              </div>

              <div className="summary-divider"></div>

              <div className="summary-item">

                <span>
                  Total Net Payroll
                </span>

                <strong>
                  {formatCurrency(
                    totalNetPayroll
                  )}
                </strong>

              </div>

            </div>

            {/* =========================
                RECENT PAYROLL
            ========================= */}

            <div className="record-card">

              <div className="record-header">

                <div>

                  <h2>
                    Payroll Records
                  </h2>

                  <p>
                    Recent payroll records from
                    the system.
                  </p>

                </div>

                <a
                  href="/payroll"
                  className="view-button"
                >
                  View Payroll
                </a>

              </div>

              <div className="table-container">

                <table>

                  <thead>

                    <tr>

                      <th>
                        EMPLOYEE
                      </th>

                      <th>
                        PAY PERIOD
                      </th>

                      <th>
                        GROSS SALARY
                      </th>

                      <th>
                        NET SALARY
                      </th>

                      <th>
                        STATUS
                      </th>

                      <th>
                        PAYMENT DATE
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {payroll.length === 0 ? (

                      <tr>

                        <td
                          colSpan={6}
                          className="empty-state"
                        >
                          No payroll records
                          found.
                        </td>

                      </tr>

                    ) : (

                      payroll
                        .slice(0, 10)
                        .map((record) => (

                          <tr
                            key={
                              record.payroll_id
                            }
                          >

                            <td>

                              <div className="employee-cell">

                                <div className="employee-avatar">

                                  {record.employee_name
                                    ?.charAt(
                                      0
                                    )
                                    .toUpperCase()}

                                </div>

                                <div>

                                  <strong>
                                    {
                                      record.employee_name
                                    }
                                  </strong>

                                  <span>
                                    Employee #
                                    {
                                      record.employee_id
                                    }
                                  </span>

                                </div>

                              </div>

                            </td>

                            <td>
                              {
                                record.pay_period
                              }
                            </td>

                            <td>
                              {formatCurrency(
                                record.gross_salary
                              )}
                            </td>

                            <td>

                              <strong>
                                {formatCurrency(
                                  record.net_salary
                                )}
                              </strong>

                            </td>

                            <td>

                              <span
                                className={`status-badge ${record.payroll_status
                                  ?.toLowerCase()
                                  .replace(
                                    " ",
                                    "-"
                                  )}`}
                              >
                                {
                                  record.payroll_status
                                }
                              </span>

                            </td>

                            <td>
                              {formatDate(
                                record.payment_date
                              )}
                            </td>

                          </tr>

                        ))

                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </>

        )}

      </main>

    </div>
  );
}