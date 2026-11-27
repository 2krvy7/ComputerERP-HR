"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HRISSidebar from "@/components/HRISSidebar";
import "./dashboard.css";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  position_id?: number;
  position_name?: string;
  employment_status: string;
  hire_date?: string;
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

type PayrollPeriodFilter = "week" | "month" | "year";

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [recruitments, setRecruitments] = useState<Recruitment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  // Prevent multiple fetch requests from running at the same time
  const [isFetching, setIsFetching] = useState(false);

  // Date is stored in state so it is not calculated during prerender
  const [currentDate, setCurrentDate] = useState("");
  const [today, setToday] = useState("");

  // Payroll Summary filter
  const [payrollPeriodFilter, setPayrollPeriodFilter] =
    useState<PayrollPeriodFilter>("month");

  useEffect(() => {
    // =========================
    // CURRENT DATE
    // =========================

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

    // =========================
    // INITIAL DATA LOAD
    // =========================

    fetchDashboardData(true);
  }, []);

  // =========================
  // FETCH DASHBOARD DATA
  // =========================

  const fetchDashboardData = async (showLoading = false) => {
    if (isFetching) {
      return;
    }

    try {
      setIsFetching(true);

      if (showLoading) {
        setLoading(true);
      }

      // =========================
      // FETCH ALL API DATA
      // =========================

      const results = await Promise.allSettled([
        fetch(`${API}/employees/`, {
          cache: "no-store",
        }),

        fetch(`${API}/positions/`, {
          cache: "no-store",
        }),

        fetch(`${API}/applicants/`, {
          cache: "no-store",
        }),

        fetch(`${API}/recruitment/`, {
          cache: "no-store",
        }),

        fetch(`${API}/attendance/?_=${Date.now()}`, {
          cache: "no-store",
        }),

        fetch(`${API}/leave/`, {
          cache: "no-store",
        }),

        fetch(`${API}/payroll/?_=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);

      // =========================
      // EMPLOYEES
      // =========================

      if (results[0].status === "fulfilled") {
        if (results[0].value.ok) {
          const data = await results[0].value.json();
          setEmployees(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Employees API error:",
            results[0].value.status
          );
        }
      } else {
        console.error(
          "Employees fetch failed:",
          results[0].reason
        );
      }

      // =========================
      // POSITIONS
      // =========================

      if (results[1].status === "fulfilled") {
        if (results[1].value.ok) {
          const data = await results[1].value.json();
          setPositions(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Positions API error:",
            results[1].value.status
          );
        }
      } else {
        console.error(
          "Positions fetch failed:",
          results[1].reason
        );
      }

      // =========================
      // APPLICANTS
      // =========================

      if (results[2].status === "fulfilled") {
        if (results[2].value.ok) {
          const data = await results[2].value.json();
          setApplicants(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Applicants API error:",
            results[2].value.status
          );
        }
      } else {
        console.error(
          "Applicants fetch failed:",
          results[2].reason
        );
      }

      // =========================
      // RECRUITMENT
      // =========================

      if (results[3].status === "fulfilled") {
        if (results[3].value.ok) {
          const data = await results[3].value.json();
          setRecruitments(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Recruitment API error:",
            results[3].value.status
          );
        }
      } else {
        console.error(
          "Recruitment fetch failed:",
          results[3].reason
        );
      }

      // =========================
      // ATTENDANCE
      // =========================

      if (results[4].status === "fulfilled") {
        if (results[4].value.ok) {
          const data = await results[4].value.json();
          setAttendance(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Attendance API error:",
            results[4].value.status
          );
        }
      } else {
        console.error(
          "Attendance fetch failed:",
          results[4].reason
        );
      }

      // =========================
      // LEAVE
      // =========================

      if (results[5].status === "fulfilled") {
        if (results[5].value.ok) {
          const data = await results[5].value.json();
          setLeaves(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Leave API error:",
            results[5].value.status
          );
        }
      } else {
        console.error(
          "Leave fetch failed:",
          results[5].reason
        );
      }

      // =========================
      // PAYROLL
      // =========================

      if (results[6].status === "fulfilled") {
        if (results[6].value.ok) {
          const data = await results[6].value.json();

          console.log(
            "Dashboard payroll data:",
            data
          );

          setPayroll(Array.isArray(data) ? data : []);
        } else {
          console.error(
            "Payroll API error:",
            results[6].value.status
          );
        }
      } else {
        console.error(
          "Payroll fetch failed:",
          results[6].reason
        );
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsFetching(false);

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

  const totalEmployees = employees.filter(
    (employee) =>
      employee.employment_status?.toLowerCase() !== "archived"
  ).length;

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

  /*
   * Archived employees are hidden.
   *
   * Employees are sorted by hire_date so the
   * newest recruited employee appears first.
   *
   * If two employees have the same hire date,
   * employee_id is used as the fallback.
   */
  const recentEmployees = [...employees]
    .filter(
      (employee) =>
        employee.employment_status?.toLowerCase() !== "archived"
    )
    .sort((a, b) => {
      const dateA = a.hire_date
        ? new Date(a.hire_date).getTime()
        : 0;

      const dateB = b.hire_date
        ? new Date(b.hire_date).getTime()
        : 0;

      if (dateB !== dateA) {
        return dateB - dateA;
      }

      return b.employee_id - a.employee_id;
    });

  // =========================
  // PAYROLL
  // =========================

  const getPayPeriodEndDate = (payPeriod: string) => {
    if (!payPeriod) return 0;

    const match = payPeriod.match(
      /^([A-Za-z]+)\s+\d{1,2}-(\d{1,2}),\s*(\d{4})$/
    );

    if (!match) return 0;

    const monthName = match[1];
    const endDay = Number(match[2]);
    const year = Number(match[3]);

    const monthIndex = new Date(
      `${monthName} 1, ${year}`
    ).getMonth();

    if (isNaN(monthIndex)) return 0;

    return new Date(
      year,
      monthIndex,
      endDay
    ).getTime();
  };

  const getPayPeriodStartDate = (payPeriod: string) => {
    if (!payPeriod) return 0;

    const match = payPeriod.match(
      /^([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})$/
    );

    if (!match) return 0;

    const monthName = match[1];
    const startDay = Number(match[2]);
    const year = Number(match[4]);

    const monthIndex = new Date(
      `${monthName} 1, ${year}`
    ).getMonth();

    if (isNaN(monthIndex)) return 0;

    return new Date(
      year,
      monthIndex,
      startDay
    ).getTime();
  };

  const latestPayroll = [...payroll].sort((a, b) => {
    const dateDifference =
      getPayPeriodEndDate(b.pay_period) -
      getPayPeriodEndDate(a.pay_period);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return b.payroll_id - a.payroll_id;
  });

  const latestPayPeriod =
    latestPayroll.length > 0
      ? latestPayroll[0].pay_period
      : "";

  const latestPeriodPayroll = payroll.filter(
    (item) =>
      item.pay_period === latestPayPeriod
  );

  const latestPeriodEnd =
    latestPayPeriod
      ? getPayPeriodEndDate(latestPayPeriod)
      : 0;

  const latestPeriodStart =
    latestPayPeriod
      ? getPayPeriodStartDate(latestPayPeriod)
      : 0;

  const filteredPayroll = payroll.filter((item) => {
    const startDate = getPayPeriodStartDate(
      item.pay_period
    );

    const endDate = getPayPeriodEndDate(
      item.pay_period
    );

    if (!startDate || !endDate || !latestPeriodEnd) {
      return false;
    }

    // =========================
    // WEEK
    // =========================

    if (payrollPeriodFilter === "week") {
      const latestDate = new Date(
        latestPeriodEnd
      );

      const day = latestDate.getDay();

      const weekStart = new Date(
        latestDate
      );

      weekStart.setDate(
        latestDate.getDate() -
          (day === 0 ? 6 : day - 1)
      );

      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(
        weekStart
      );

      weekEnd.setDate(
        weekStart.getDate() + 6
      );

      weekEnd.setHours(
        23,
        59,
        59,
        999
      );

      return (
        endDate >= weekStart.getTime() &&
        startDate <= weekEnd.getTime()
      );
    }

    // =========================
    // MONTH
    // =========================

    if (payrollPeriodFilter === "month") {
      const latestDate = new Date(
        latestPeriodEnd
      );

      const latestYear =
        latestDate.getFullYear();

      const latestMonth =
        latestDate.getMonth();

      const monthStart = new Date(
        latestYear,
        latestMonth,
        1
      ).getTime();

      const monthEnd = new Date(
        latestYear,
        latestMonth + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime();

      return (
        endDate >= monthStart &&
        startDate <= monthEnd
      );
    }

    // =========================
    // YEAR
    // =========================

    if (payrollPeriodFilter === "year") {
      const latestDate = new Date(
        latestPeriodEnd
      );

      const latestYear =
        latestDate.getFullYear();

      const yearStart = new Date(
        latestYear,
        0,
        1
      ).getTime();

      const yearEnd = new Date(
        latestYear,
        11,
        31,
        23,
        59,
        59,
        999
      ).getTime();

      return (
        endDate >= yearStart &&
        startDate <= yearEnd
      );
    }

    return false;
  });

  const displayedPayroll =
    filteredPayroll.length > 0
      ? filteredPayroll
      : payrollPeriodFilter === "month"
      ? latestPeriodPayroll
      : [];

  const totalPayroll = displayedPayroll.reduce(
    (total, item) =>
      total +
      Number(item.net_salary || 0),
    0
  );

  const recentPayroll = [...displayedPayroll]
    .sort((a, b) => {
      const dateDifference =
        getPayPeriodEndDate(b.pay_period) -
        getPayPeriodEndDate(a.pay_period);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return b.payroll_id - a.payroll_id;
    })
    .slice(0, 4);

  const payrollSummaryLabel =
    payrollPeriodFilter === "week"
      ? "Weekly payroll overview"
      : payrollPeriodFilter === "month"
      ? latestPayPeriod
        ? `Payroll period: ${latestPayPeriod}`
        : "Monthly payroll overview"
      : latestPayPeriod
      ? `Payroll year: ${new Date(
          latestPeriodEnd
        ).getFullYear()}`
      : "Yearly payroll overview";

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

            <Link
              href="/employees"
              className="stat-card stat-card-link"
            >
              <div className="stat-title">
                TOTAL EMPLOYEES
              </div>

              <div className="stat-number">
                {loading ? "..." : totalEmployees}
              </div>

              <div className="stat-description">
                {activeEmployees} active employees
              </div>
            </Link>

            <Link
              href="/recruitment"
              className="stat-card stat-card-link"
            >
              <div className="stat-title">
                PENDING APPLICANTS
              </div>

              <div className="stat-number">
                {loading ? "..." : pendingApplicants}
              </div>

              <div className="stat-description">
                Applications to review
              </div>
            </Link>

            <Link
              href="/attendance"
              className="stat-card stat-card-link"
            >
              <div className="stat-title">
                TODAY'S ATTENDANCE
              </div>

              <div className="stat-number">
                {loading ? "..." : presentToday}
              </div>

              <div className="stat-description">
                Present today
              </div>
            </Link>

            <Link
              href="/leave"
              className="stat-card stat-card-link"
            >
              <div className="stat-title">
                PENDING LEAVE
              </div>

              <div className="stat-number">
                {loading ? "..." : pendingLeave}
              </div>

              <div className="stat-description">
                Requests awaiting approval
              </div>
            </Link>

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

            {/* SCROLLABLE RECENT EMPLOYEES */}

            <div
              className="table-wrapper"
              style={{
                maxHeight: "320px",
                overflowY: "auto",
                paddingBottom: "10px",
                boxSizing: "border-box",
              }}
            >

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

                <button
                  type="button"
                  className={
                    payrollPeriodFilter === "week"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setPayrollPeriodFilter("week")
                  }
                >
                  Week
                </button>

                <button
                  type="button"
                  className={
                    payrollPeriodFilter === "month"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setPayrollPeriodFilter("month")
                  }
                >
                  Month
                </button>

                <button
                  type="button"
                  className={
                    payrollPeriodFilter === "year"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setPayrollPeriodFilter("year")
                  }
                >
                  Year
                </button>

              </div>

            </div>

            <div className="payroll-total">

              <span>
                Total Payroll
              </span>

              <strong>
                ₱
                {totalPayroll.toLocaleString(
                  "en-PH",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>

              <small>
                {payrollSummaryLabel}
              </small>

            </div>

            <div className="chart">

              {recentPayroll.length === 0 ? (

                <div style={{ padding: "20px" }}>
                  No payroll records found.
                </div>

              ) : (

                recentPayroll.map((item, index) => {

                  const maxPayroll =
                    Math.max(
                      ...recentPayroll.map(
                        (record) =>
                          Number(
                            record.net_salary || 0
                          )
                      ),
                      1
                    );

                  const height =
                    (Number(
                      item.net_salary || 0
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
                            item.net_salary || 0
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
                <span
                  key={item.payroll_id}
                >
                  {item.employee_name ||
                    `Employee ${item.employee_id}`}
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