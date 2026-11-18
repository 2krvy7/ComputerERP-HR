"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HRISSidebar from "@/components/HRISSidebar";
import "./dashboard.css";

const API = "http://127.0.0.1:8000";

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  position_id?: number;
  position_name?: string;
  employment_status: string;
};

type Position = {
  position_id: number;
  position_name: string;
};

type Applicant = {
  applicant_id: number;
  first_name: string;
  last_name: string;
  status: string;
};

type Recruitment = {
  recruitment_id: number;
  applicant_id: number;
  recruitment_status: string;
};

type Attendance = {
  attendance_id: number;
  employee_id: number;
  date: string;
  status: string;
};

type Leave = {
  leave_id: number;
  employee_id: number;
  employee_name?: string;
  leave_type: string;
  status: string;
};

type Payroll = {
  payroll_id: number;
  employee_id: number;
  employee_name?: string;
  gross_salary: number;
  net_salary: number;
  payroll_status: string;
  pay_period: string;
};

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [recruitments, setRecruitments] = useState<Recruitment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  // Date is stored in state so it is not calculated during prerender
  const [currentDate, setCurrentDate] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    // =========================
    // CURRENT DATE
    // =========================

    const updateDate = () => {
      const now = new Date();

      setCurrentDate(
        now.toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Manila",
        })
      );

      setToday(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
        }).format(now)
      );
    };

    updateDate();

    // =========================
    // INITIAL DATA LOAD
    // =========================

    fetchDashboardData(true);

    // =========================
    // REFRESH EVERY 3 SECONDS
    // =========================

    const interval = setInterval(() => {
      updateDate();

      // Silent refresh.
      // This does NOT set loading to true,
      // so the cards will not blink.
      fetchDashboardData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showLoading = false) => {
    try {
      // Only show loading on the first page load
      if (showLoading) {
        setLoading(true);
      }

      const [
        employeesRes,
        positionsRes,
        applicantsRes,
        recruitmentRes,
        attendanceRes,
        leaveRes,
        payrollRes,
      ] = await Promise.all([
        fetch(`${API}/employees/`),
        fetch(`${API}/positions/`),
        fetch(`${API}/applicants/`),
        fetch(`${API}/recruitment/`),

        // Force fresh attendance data
        fetch(`${API}/attendance/?_=${Date.now()}`),

        fetch(`${API}/leave/`),
        fetch(`${API}/payroll/`),
      ]);

      const [
        employeesData,
        positionsData,
        applicantsData,
        recruitmentData,
        attendanceData,
        leaveData,
        payrollData,
      ] = await Promise.all([
        employeesRes.json(),
        positionsRes.json(),
        applicantsRes.json(),
        recruitmentRes.json(),
        attendanceRes.json(),
        leaveRes.json(),
        payrollRes.json(),
      ]);

      setEmployees(employeesData);
      setPositions(positionsData);
      setApplicants(applicantsData);
      setRecruitments(recruitmentData);
      setAttendance(attendanceData);
      setLeaves(leaveData);
      setPayroll(payrollData);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      // Only turn loading off if this was the initial load
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // =========================
  // POSITION NAME
  // =========================

  const getPositionName = (positionId?: number) => {
    if (!positionId) return "No Position";

    const position = positions.find(
      (item) => item.position_id === positionId
    );

    return position?.position_name || `Position ${positionId}`;
  };

  // =========================
  // EMPLOYEE SUMMARY
  // =========================

  const totalEmployees = employees.length;

  const activeEmployees = employees.filter(
    (employee) =>
      employee.employment_status?.toLowerCase() === "active"
  ).length;

  // =========================
  // APPLICANTS
  // =========================

  const pendingApplicants = recruitments.filter(
    (item) =>
      item.recruitment_status?.toLowerCase() !== "hired"
  ).length;

  // =========================
  // TODAY'S ATTENDANCE
  // =========================

  const todayAttendance = attendance.filter((item) => {
    const attendanceDate = String(item.date).substring(0, 10);

    return attendanceDate === today;
  });

  const presentToday = todayAttendance.filter(
    (item) => item.status?.toLowerCase() === "present"
  ).length;

  const lateToday = todayAttendance.filter(
    (item) => item.status?.toLowerCase() === "late"
  ).length;

  const absentToday = todayAttendance.filter(
    (item) => item.status?.toLowerCase() === "absent"
  ).length;

  const leaveToday = todayAttendance.filter(
    (item) => item.status?.toLowerCase() === "leave"
  ).length;

  // =========================
  // PENDING LEAVE
  // =========================

  const pendingLeave = leaves.filter(
    (item) => item.status?.toLowerCase() === "pending"
  ).length;

  // =========================
  // RECENT EMPLOYEES
  // =========================

  const recentEmployees = [...employees]
    .sort((a, b) => b.employee_id - a.employee_id)
    .slice(0, 4);

  // =========================
  // PAYROLL
  // =========================

  const totalPayroll = payroll.reduce(
    (total, item) =>
      total + Number(item.gross_salary || 0),
    0
  );

  const recentPayroll = [...payroll]
    .sort((a, b) => b.payroll_id - a.payroll_id)
    .slice(0, 4);

  // =========================
  // RECENT LEAVE REQUESTS
  // =========================

  const recentLeaves = [...leaves]
    .sort((a, b) => b.leave_id - a.leave_id)
    .slice(0, 3);

  // =========================
  // AVATAR
  // =========================

  const getInitials = (
    firstName: string,
    lastName: string
  ) => {
    return `${firstName?.charAt(0) || ""}${
      lastName?.charAt(0) || ""
    }`.toUpperCase();
  };

  // =========================
  // STATUS CLASS
  // =========================

  const getStatusClass = (status: string) => {
    const value = status?.toLowerCase();

    if (value === "active") return "active";
    if (value === "on leave" || value === "leave")
      return "leave";
    if (value === "pending") return "pending";
    if (value === "approved") return "approved";
    if (value === "rejected") return "rejected";
    if (value === "paid") return "paid";
    if (value === "processed") return "processed";

    return "pending";
  };

  return (
    <div className="employees-page">

      {/* =========================
          SHARED HRIS SIDEBAR
      ========================= */}

      <HRISSidebar />

      {/* =========================
          MAIN CONTENT
      ========================= */}

      <main className="main-content">

        {/* HEADER */}

        <div className="page-header">

          <div>
            <h1>Dashboard</h1>

            <p>
              Welcome back! Here's your HR overview.
            </p>
          </div>

          <div className="date">
            {currentDate}
          </div>

        </div>

        {/* =========================
            SUMMARY CARDS
        ========================= */}

        <div className="stats-grid">

          <div className="stat-card">

            <div className="stat-title">
              TOTAL EMPLOYEES
            </div>

            <div className="stat-number">
              {loading ? "..." : totalEmployees}
            </div>

            <div className="stat-description">
              {activeEmployees} active employees
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-title">
              PENDING APPLICANTS
            </div>

            <div className="stat-number">
              {loading ? "..." : pendingApplicants}
            </div>

            <div className="stat-description">
              Applications to review
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-title">
              TODAY'S ATTENDANCE
            </div>

            <div className="stat-number">
              {loading ? "..." : presentToday}
            </div>

            <div className="stat-description">
              Present today
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-title">
              PENDING LEAVE
            </div>

            <div className="stat-number">
              {loading ? "..." : pendingLeave}
            </div>

            <div className="stat-description">
              Requests awaiting approval
            </div>

          </div>

        </div>

        {/* =========================
            MIDDLE SECTION
        ========================= */}

        <div className="dashboard-grid">

          {/* RECENT EMPLOYEES */}

          <div className="employee-card">

            <div className="card-header">

              <div>
                <h2>
                  Recent Employees
                </h2>

                <p>
                  Recently added employees
                </p>
              </div>

              <Link
                href="/employees"
                className="view-link"
              >
                View all →
              </Link>

            </div>

            <div className="table-wrapper">

              <table>

                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>POSITION</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>

                  {recentEmployees.length === 0 ? (

                    <tr>
                      <td colSpan={3}>
                        No employees found.
                      </td>
                    </tr>

                  ) : (

                    recentEmployees.map((employee) => (

                      <tr key={employee.employee_id}>

                        <td>

                          <div className="employee-name">

                            <div className="employee-avatar">
                              {getInitials(
                                employee.first_name,
                                employee.last_name
                              )}
                            </div>

                            <div>

                              <strong>
                                {employee.first_name}{" "}
                                {employee.last_name}
                              </strong>

                              <small>
                                ID:{" "}
                                {String(
                                  employee.employee_id
                                ).padStart(3, "0")}
                              </small>

                            </div>

                          </div>

                        </td>

                        <td>
                          {getPositionName(
                            employee.position_id
                          )}
                        </td>

                        <td>

                          <span
                            className={`status ${getStatusClass(
                              employee.employment_status
                            )}`}
                          >
                            {employee.employment_status}
                          </span>

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* PAYROLL SUMMARY */}

          <div className="employee-card">

            <div className="card-header">

              <div>
                <h2>
                  Payroll Summary
                </h2>

                <p>
                  Current payroll overview
                </p>
              </div>

              <div className="period-buttons">

                <button className="selected">
                  Week
                </button>

                <button>
                  Month
                </button>

                <button>
                  Year
                </button>

              </div>

            </div>

            <div className="payroll-total">

              <span>
                Total Payroll
              </span>

              <strong>
                ₱{totalPayroll.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>

              <small>
                Current payroll records
              </small>

            </div>

            <div className="chart">

              {recentPayroll.length === 0 ? (

                <div style={{ padding: "20px" }}>
                  No payroll records found.
                </div>

              ) : (

                recentPayroll.map((item, index) => {

                  const maxPayroll = Math.max(
                    ...recentPayroll.map(
                      (record) =>
                        Number(
                          record.gross_salary || 0
                        )
                    ),
                    1
                  );

                  const height =
                    (Number(
                      item.gross_salary || 0
                    ) /
                      maxPayroll) *
                    100;

                  return (
                    <div
                      className={`bar bar-${index + 1}`}
                      key={item.payroll_id}
                      style={{
                        height: `${Math.max(
                          height,
                          10
                        )}%`,
                      }}
                    >
                      <span>
                        ₱
                        {(
                          Number(
                            item.gross_salary || 0
                          ) / 1000
                        ).toFixed(0)}
                        K
                      </span>
                    </div>
                  );
                })

              )}

            </div>

            <div className="chart-labels">

              {recentPayroll.map((item) => (
                <span key={item.payroll_id}>
                  {item.pay_period}
                </span>
              ))}

            </div>

          </div>

        </div>

        {/* =========================
            BOTTOM SECTION
        ========================= */}

        <div className="bottom-grid">

          {/* ATTENDANCE */}

          <div className="employee-card">

            <div className="card-header">

              <div>
                <h2>
                  Today's Attendance
                </h2>

                <p>
                  Attendance overview for today
                </p>
              </div>

              <Link
                href="/attendance"
                className="view-link"
              >
                View all →
              </Link>

            </div>

            <div className="attendance-summary">

              <div>
                <strong>
                  {presentToday}
                </strong>

                <span>
                  Present
                </span>
              </div>

              <div>
                <strong>
                  {lateToday}
                </strong>

                <span>
                  Late
                </span>
              </div>

              <div>
                <strong>
                  {absentToday}
                </strong>

                <span>
                  Absent
                </span>
              </div>

              <div>
                <strong>
                  {leaveToday}
                </strong>

                <span>
                  On Leave
                </span>
              </div>

            </div>

          </div>

          {/* LEAVE REQUESTS */}

          <div className="employee-card">

            <div className="card-header">

              <div>
                <h2>
                  Leave Requests
                </h2>

                <p>
                  Recent leave requests
                </p>
              </div>

              <Link
                href="/leave"
                className="view-link"
              >
                View all →
              </Link>

            </div>

            <div className="leave-list">

              {recentLeaves.length === 0 ? (

                <div className="leave-item">

                  <div>

                    <strong>
                      No leave requests
                    </strong>

                    <span>
                      There are no records yet.
                    </span>

                  </div>

                </div>

              ) : (

                recentLeaves.map((leave) => (

                  <div
                    className="leave-item"
                    key={leave.leave_id}
                  >

                    <div>

                      <strong>
                        {leave.employee_name ||
                          `Employee ${leave.employee_id}`}
                      </strong>

                      <span>
                        {leave.leave_type}
                      </span>

                    </div>

                    <span
                      className={`status ${getStatusClass(
                        leave.status
                      )}`}
                    >
                      {leave.status}
                    </span>

                  </div>

                ))

              )}

            </div>

          </div>

        </div>

        {/* FOOTER */}

        <div className="table-footer">
          HRIS & Payroll System • Dashboard
        </div>

      </main>

    </div>
  );
}