"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/EmployeeSidebar";
import "./employee-dashboard.css";

const API = "http://127.0.0.1:8000";

// Temporary employee ID.
// Later, this can come from the logged-in user's account.
const CURRENT_EMPLOYEE_ID = 2;

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  contact_no: string;
  address: string;
  hire_date: string;
  employment_status: string;
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

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  // These are set only after the component mounts.
  // This prevents the Next.js prerender error.
  const [currentDate, setCurrentDate] = useState("");
  const [todayString, setTodayString] = useState("");

  /*
   * Fetch all employee dashboard information.
   */
  const fetchEmployeeDashboard = async () => {
    try {
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
        throw new Error("Failed to load employee dashboard.");
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

      const currentEmployee = employeesData.find(
        (emp: Employee) =>
          Number(emp.employee_id) === CURRENT_EMPLOYEE_ID
      );

      const myAttendance = attendanceData.filter(
        (record: Attendance) =>
          Number(record.employee_id) === CURRENT_EMPLOYEE_ID
      );

      const myLeave = leaveData.filter(
        (record: LeaveRecord) =>
          Number(record.employee_id) === CURRENT_EMPLOYEE_ID
      );

      const myPayroll = payrollData.filter(
        (record: Payroll) =>
          Number(record.employee_id) === CURRENT_EMPLOYEE_ID
      );

      setEmployee(currentEmployee || null);
      setAttendance(myAttendance);
      setLeaveRecords(myLeave);
      setPayroll(myPayroll);
    } catch (error) {
      console.error(
        "Error loading employee dashboard:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Initial load + automatic refresh.
   *
   * The employee can Time In/Time Out from
   * Employee Attendance, so the dashboard
   * refreshes every 3 seconds.
   */
  useEffect(() => {
    const updateDate = () => {
      const now = new Date();

      const manilaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      const displayDate = new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(now);

      setTodayString(manilaDate);
      setCurrentDate(displayDate);
    };

    updateDate();
    fetchEmployeeDashboard();

    const interval = setInterval(() => {
      updateDate();
      fetchEmployeeDashboard();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     ATTENDANCE
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

  /*
   * Find today's attendance.
   *
   * todayString is set inside useEffect,
   * so it is NOT calculated during prerender.
   */
  const todayAttendance = attendance.find(
    (record) =>
      String(record.date).substring(0, 10) ===
      todayString
  );

  /* =========================
     LEAVE
  ========================= */

  const pendingLeaves = leaveRecords.filter(
    (record) =>
      record.status?.toLowerCase() === "pending"
  ).length;

  const approvedLeaves = leaveRecords.filter(
    (record) =>
      record.status?.toLowerCase() === "approved"
  ).length;

  /* =========================
     PAYROLL
  ========================= */

  const latestPayroll =
    payroll.length > 0
      ? payroll[payroll.length - 1]
      : null;

  /* =========================
     FORMATTERS
  ========================= */

  const formatCurrency = (value: number) => {
    return `₱${Number(value || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  /*
   * Safely format YYYY-MM-DD dates.
   * This avoids timezone problems and Invalid Date.
   */
  const formatDate = (date: string | null) => {
    if (!date) {
      return "-";
    }

    const dateOnly = String(date).substring(0, 10);
    const parts = dateOnly.split("-");

    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      if (
        !Number.isNaN(year) &&
        !Number.isNaN(month) &&
        !Number.isNaN(day)
      ) {
        const localDate = new Date(
          year,
          month - 1,
          day
        );

        return localDate.toLocaleDateString(
          "en-PH",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        );
      }
    }

    return String(date);
  };

  /*
   * Convert HH:MM or HH:MM:SS into AM/PM format.
   */
  const formatTime = (time: string | null) => {
    if (!time) {
      return "-";
    }

    const timeOnly = String(time).substring(0, 5);
    const parts = timeOnly.split(":");

    if (parts.length < 2) {
      return timeOnly;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return "-";
    }

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(minutes).padStart(
      2,
      "0"
    )} ${suffix}`;
  };

  if (loading) {
    return (
      <div className="employee-loading">
        Loading employee dashboard...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="employee-loading">
        Employee record not found.
      </div>
    );
  }

  return (
    <div className="employee-dashboard">

      {/* =========================
          EMPLOYEE SIDEBAR
      ========================= */}

      <EmployeeSidebar
        username={`${employee.first_name} ${employee.last_name}`}
        userId={`EMP-${String(
          employee.employee_id
        ).padStart(3, "0")}`}
        role="Employee"
      />

      {/* =========================
          MAIN CONTENT
      ========================= */}

      <main className="employee-main">

        {/* WELCOME */}

        <div className="welcome-card">
          <div>
            <p className="welcome-small">
              Employee Dashboard
            </p>

            <h1>
              Welcome back, {employee.first_name}!
            </h1>

            <p className="welcome-text">
              Here's a quick overview of your HR
              information.
            </p>
          </div>

          <div className="welcome-avatar">
            {employee.first_name
              ?.charAt(0)
              .toUpperCase()}
          </div>
        </div>

        {/* TODAY'S ATTENDANCE */}

        <div className="section-title">
          <div>
            <h2>Today's Attendance</h2>

            <p>
              Your attendance status for today.
            </p>
          </div>

          <span>
            {currentDate}
          </span>
        </div>

        <div className="today-attendance-card">

          <div className="attendance-status">
            <div className="attendance-icon">
              🕐
            </div>

            <div>
              <span>Status</span>

              <strong>
                {todayAttendance
                  ? todayAttendance.status
                  : "No Record"}
              </strong>
            </div>
          </div>

          <div className="time-item">
            <span>Time In</span>

            <strong>
              {todayAttendance
                ? formatTime(
                    todayAttendance.time_in
                  )
                : "-"}
            </strong>
          </div>

          <div className="time-item">
            <span>Time Out</span>

            <strong>
              {todayAttendance
                ? formatTime(
                    todayAttendance.time_out
                  )
                : "-"}
            </strong>
          </div>

        </div>

        {/* ATTENDANCE SUMMARY */}

        <div className="stats-grid">

          <div className="employee-stat-card">
            <span>Present Days</span>

            <strong>{presentDays}</strong>

            <small>
              This attendance record
            </small>
          </div>

          <div className="employee-stat-card">
            <span>Absent Days</span>

            <strong>{absentDays}</strong>

            <small>
              This attendance record
            </small>
          </div>

          <div className="employee-stat-card">
            <span>Late Days</span>

            <strong>{lateDays}</strong>

            <small>
              This attendance record
            </small>
          </div>

          <div className="employee-stat-card">
            <span>Pending Leave</span>

            <strong>{pendingLeaves}</strong>

            <small>
              Leave requests
            </small>
          </div>

        </div>

        {/* PAYROLL + LEAVE */}

        <div className="dashboard-grid">

          {/* PAYROLL */}

          <div className="dashboard-card">

            <div className="card-header">

              <div>
                <h2>Latest Payroll</h2>

                <p>
                  Your most recent salary
                  information.
                </p>
              </div>

              <span className="card-icon">
                💰
              </span>

            </div>

            {latestPayroll ? (
              <>
                <div className="pay-period">
                  {latestPayroll.pay_period}
                </div>

                <div className="payroll-amount">

                  <span>Net Salary</span>

                  <strong>
                    {formatCurrency(
                      latestPayroll.net_salary
                    )}
                  </strong>

                </div>

                <div className="payroll-details">

                  <div>
                    <span>Gross Salary</span>

                    <strong>
                      {formatCurrency(
                        latestPayroll.gross_salary
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Overtime</span>

                    <strong>
                      {formatCurrency(
                        latestPayroll.overtime
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Deductions</span>

                    <strong>
                      {formatCurrency(
                        Number(
                          latestPayroll.sss || 0
                        ) +
                          Number(
                            latestPayroll.philhealth ||
                              0
                          ) +
                          Number(
                            latestPayroll.pag_ibig ||
                              0
                          ) +
                          Number(
                            latestPayroll.deductions ||
                              0
                          )
                      )}
                    </strong>
                  </div>

                </div>

                <span
                  className={`payroll-status ${latestPayroll.payroll_status
                    ?.toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {latestPayroll.payroll_status}
                </span>
              </>
            ) : (
              <div className="no-data">
                No payroll record available.
              </div>
            )}

          </div>

          {/* LEAVE */}

          <div className="dashboard-card">

            <div className="card-header">

              <div>
                <h2>My Leave</h2>

                <p>
                  Your recent leave requests.
                </p>
              </div>

              <span className="card-icon">
                📅
              </span>

            </div>

            <div className="leave-summary">

              <div>
                <span>Pending</span>

                <strong>
                  {pendingLeaves}
                </strong>
              </div>

              <div>
                <span>Approved</span>

                <strong>
                  {approvedLeaves}
                </strong>
              </div>

            </div>

            <div className="leave-list">

              {leaveRecords.length === 0 ? (
                <div className="no-data">
                  No leave requests found.
                </div>
              ) : (
                leaveRecords
                  .slice(-3)
                  .reverse()
                  .map((leave) => (
                    <div
                      className="leave-item"
                      key={leave.leave_id}
                    >

                      <div>

                        <strong>
                          {leave.leave_type}
                        </strong>

                        <span>
                          {formatDate(
                            leave.start_date
                          )}{" "}
                          -{" "}
                          {formatDate(
                            leave.end_date
                          )}
                        </span>

                      </div>

                      <span
                        className={`leave-status ${leave.status?.toLowerCase()}`}
                      >
                        {leave.status}
                      </span>

                    </div>
                  ))
              )}

            </div>

          </div>

        </div>

        {/* RECENT ATTENDANCE */}

        <div className="dashboard-card recent-card">

          <div className="card-header">

            <div>
              <h2>Recent Attendance</h2>

              <p>
                Your latest attendance records.
              </p>
            </div>

            <a href="/employee-attendance">
              View All
            </a>

          </div>

          <div className="attendance-list">

            {attendance.length === 0 ? (
              <div className="no-data">
                No attendance records found.
              </div>
            ) : (
              attendance
                .slice(-5)
                .reverse()
                .map((record) => (
                  <div
                    className="attendance-row"
                    key={record.attendance_id}
                  >

                    <div>

                      <strong>
                        {formatDate(record.date)}
                      </strong>

                      <span>
                        Time In:{" "}
                        {formatTime(
                          record.time_in
                        )}
                      </span>

                    </div>

                    <div>

                      <span>
                        Time Out
                      </span>

                      <strong>
                        {formatTime(
                          record.time_out
                        )}
                      </strong>

                    </div>

                    <span
                      className={`attendance-badge ${record.status?.toLowerCase()}`}
                    >
                      {record.status}
                    </span>

                  </div>
                ))
            )}

          </div>

        </div>

        {/* QUICK ACTIONS */}

        <div className="quick-actions">

          <a href="/employee-attendance">
            <span>🕐</span>

            <div>
              <strong>
                My Attendance
              </strong>

              <small>
                View attendance records
              </small>
            </div>
          </a>

          <a href="/employee-leave">
            <span>📅</span>

            <div>
              <strong>
                My Leave
              </strong>

              <small>
                View leave requests
              </small>
            </div>
          </a>

          <a href="/employee-payroll">
            <span>💰</span>

            <div>
              <strong>
                My Payroll
              </strong>

              <small>
                View salary records
              </small>
            </div>
          </a>

          <a href="/employee-profile">
            <span>👤</span>

            <div>
              <strong>
                My Profile
              </strong>

              <small>
                View personal information
              </small>
            </div>
          </a>

        </div>

      </main>

    </div>
  );
}