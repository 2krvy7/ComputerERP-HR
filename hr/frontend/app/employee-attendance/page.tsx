"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/EmployeeSidebar";
import "./employee-attendance.css";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Temporary employee ID.
// Later, this will come from the logged-in employee.
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
  employee_name: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
};

export default function EmployeeAttendancePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeInLoading, setTimeInLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  // Current date is stored in state so it is not
  // calculated directly during prerender.
  const [currentDate, setCurrentDate] = useState("");
  const [todayString, setTodayString] = useState("");

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();

      // YYYY-MM-DD in Philippine time
      const manilaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      // Full display date in Philippine time
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
    fetchEmployee();
    fetchAttendance();
  }, []);

  // ==========================
  // FETCH CURRENT EMPLOYEE
  // ==========================

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`${API}/employees/`);

      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }

      const employees = await response.json();

      const currentEmployee = employees.find(
        (emp: Employee) =>
          Number(emp.employee_id) === CURRENT_EMPLOYEE_ID
      );

      setEmployee(currentEmployee || null);
    } catch (error) {
      console.error("Error fetching employee:", error);
    }
  };

  // ==========================
  // FETCH ATTENDANCE
  // ==========================

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${API}/attendance/`);

      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }

      const data = await response.json();

      const myAttendance = data.filter(
        (record: Attendance) =>
          Number(record.employee_id) === CURRENT_EMPLOYEE_ID
      );

      setAttendance(myAttendance);
    } catch (error) {
      console.error("Error fetching attendance:", error);

      setMessage("Failed to load attendance records.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  /*
   * Find today's attendance record.
   *
   * The todayString comes from state and is generated
   * using Asia/Manila timezone.
   */
  const todayAttendance = attendance.find(
    (record) =>
      String(record.date).substring(0, 10) === todayString
  );

  const hasTimedIn = !!todayAttendance?.time_in;
  const hasTimedOut = !!todayAttendance?.time_out;

  // ==========================
  // TIME IN
  // ==========================

  const handleTimeIn = async () => {
    setTimeInLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `${API}/attendance/time-in`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: CURRENT_EMPLOYEE_ID,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to time in."
        );
      }

      setMessage("Time In recorded successfully.");
      setMessageType("success");

      await fetchAttendance();
    } catch (error) {
      console.error("Time In error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to record Time In."
      );

      setMessageType("error");
    } finally {
      setTimeInLoading(false);
    }
  };

  // ==========================
  // TIME OUT
  // ==========================

  const handleTimeOut = async () => {
    if (!todayAttendance) {
      setMessage(
        "Today's attendance record was not found."
      );
      setMessageType("error");
      return;
    }

    if (!todayAttendance.time_in) {
      setMessage("You need to Time In first.");
      setMessageType("error");
      return;
    }

    if (todayAttendance.time_out) {
      setMessage(
        "You have already timed out today."
      );
      setMessageType("error");
      return;
    }

    setTimeOutLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `${API}/attendance/time-out/${todayAttendance.attendance_id}`,
        {
          method: "PUT",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to time out."
        );
      }

      setMessage("Time Out recorded successfully.");
      setMessageType("success");

      await fetchAttendance();
    } catch (error) {
      console.error("Time Out error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to record Time Out."
      );

      setMessageType("error");
    } finally {
      setTimeOutLoading(false);
    }
  };

  // ==========================
  // SUMMARY
  // ==========================

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

  // ==========================
  // FORMAT TIME
  // ==========================

  const formatTime = (time: string | null) => {
    if (!time) return "--";

    const parts = time.split(":");

    if (parts.length < 2) {
      return time;
    }

    let hour = Number(parts[0]);
    const minute = parts[1];

    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;

    if (hour === 0) {
      hour = 12;
    }

    return `${hour}:${minute} ${ampm}`;
  };

  // ==========================
  // FORMAT DATE
  // ==========================

  const formatDate = (date: string) => {
    if (!date) {
      return "--";
    }

    const cleanDate = String(date).substring(0, 10);

    const parts = cleanDate.split("-");

    if (parts.length !== 3) {
      return "--";
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      !year ||
      !month ||
      !day ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return "--";
    }

    const dateObject = new Date(
      year,
      month - 1,
      day
    );

    return dateObject.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  // ==========================
  // STATUS CLASS
  // ==========================

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case "present":
        return "status-present";

      case "late":
        return "status-late";

      case "absent":
        return "status-absent";

      case "leave":
        return "status-leave";

      default:
        return "status-default";
    }
  };

  return (
    <div className="employee-page">

      {/* SHARED EMPLOYEE SIDEBAR */}

      <EmployeeSidebar
        username={
          employee
            ? `${employee.first_name} ${employee.last_name}`
            : "Employee"
        }
        userId={
          employee
            ? `EMP-${String(employee.employee_id).padStart(3, "0")}`
            : `EMP-${String(CURRENT_EMPLOYEE_ID).padStart(3, "0")}`
        }
        role="Employee"
      />

      {/* MAIN CONTENT */}

      <main className="employee-main">

        {/* HEADER */}

        <header className="employee-header">

          <div>
            <h1>My Attendance</h1>

            <p>
              View your attendance records and attendance summary.
            </p>
          </div>

          <div className="employee-date">
            {currentDate}
          </div>

        </header>

        {/* TODAY'S ATTENDANCE */}

        <section className="today-attendance-card">

          <div className="today-attendance-header">

            <div>
              <h2>Today's Attendance</h2>

              <p>
                Record your Time In and Time Out for today.
              </p>
            </div>

            <div className="today-date">
              {currentDate}
            </div>

          </div>

          {/* MESSAGE */}

          {message && (
            <div
              className={`attendance-message ${
                messageType === "success"
                  ? "message-success"
                  : "message-error"
              }`}
            >
              {message}
            </div>
          )}

          <div className="time-actions">

            {/* TIME IN */}

            <div className="time-action-box">

              <div className="time-action-info">

                <div className="time-action-icon">
                  🕐
                </div>

                <div>
                  <span>Time In</span>

                  <strong>
                    {todayAttendance?.time_in
                      ? formatTime(
                          todayAttendance.time_in
                        )
                      : "--"}
                  </strong>
                </div>

              </div>

              <button
                type="button"
                className="time-in-button"
                onClick={handleTimeIn}
                disabled={
                  hasTimedIn ||
                  timeInLoading
                }
              >
                {timeInLoading
                  ? "Recording..."
                  : hasTimedIn
                  ? "Timed In"
                  : "Time In"}
              </button>

            </div>

            {/* TIME OUT */}

            <div className="time-action-box">

              <div className="time-action-info">

                <div className="time-action-icon">
                  🕐
                </div>

                <div>
                  <span>Time Out</span>

                  <strong>
                    {todayAttendance?.time_out
                      ? formatTime(
                          todayAttendance.time_out
                        )
                      : "--"}
                  </strong>
                </div>

              </div>

              <button
                type="button"
                className="time-out-button"
                onClick={handleTimeOut}
                disabled={
                  !hasTimedIn ||
                  hasTimedOut ||
                  timeOutLoading
                }
              >
                {timeOutLoading
                  ? "Recording..."
                  : hasTimedOut
                  ? "Timed Out"
                  : "Time Out"}
              </button>

            </div>

          </div>

        </section>

        {/* SUMMARY CARDS */}

        <section className="attendance-stats">

          <div className="attendance-stat-card">

            <div className="stat-icon">
              ✓
            </div>

            <div>
              <span>Present Days</span>

              <strong>
                {presentDays}
              </strong>
            </div>

          </div>

          <div className="attendance-stat-card">

            <div className="stat-icon">
              ✕
            </div>

            <div>
              <span>Absent Days</span>

              <strong>
                {absentDays}
              </strong>
            </div>

          </div>

          <div className="attendance-stat-card">

            <div className="stat-icon">
              🕐
            </div>

            <div>
              <span>Late Days</span>

              <strong>
                {lateDays}
              </strong>
            </div>

          </div>

          <div className="attendance-stat-card">

            <div className="stat-icon">
              📋
            </div>

            <div>
              <span>Total Records</span>

              <strong>
                {attendance.length}
              </strong>
            </div>

          </div>

        </section>

        {/* ATTENDANCE TABLE */}

        <section className="attendance-record-card">

          <div className="record-header">

            <div>
              <h2>Attendance Records</h2>

              <p>
                Your personal attendance history
              </p>
            </div>

          </div>

          {loading ? (

            <div className="attendance-empty">

              <div className="loading-spinner"></div>

              <p>
                Loading attendance records...
              </p>

            </div>

          ) : attendance.length === 0 ? (

            <div className="attendance-empty">

              <div className="empty-icon">
                📋
              </div>

              <h3>
                No Attendance Records
              </h3>

              <p>
                You don't have any attendance records yet.
              </p>

            </div>

          ) : (

            <div className="attendance-table-wrapper">

              <table className="attendance-table">

                <thead>

                  <tr>
                    <th>DATE</th>
                    <th>TIME IN</th>
                    <th>TIME OUT</th>
                    <th>STATUS</th>
                  </tr>

                </thead>

                <tbody>

                  {attendance.map((record) => (

                    <tr
                      key={record.attendance_id}
                    >

                      <td>

                        <div className="date-cell">

                          <span className="date-icon">
                            📅
                          </span>

                          <div>
                            <strong>
                              {formatDate(
                                record.date
                              )}
                            </strong>
                          </div>

                        </div>

                      </td>

                      <td>
                        {formatTime(
                          record.time_in
                        )}
                      </td>

                      <td>
                        {formatTime(
                          record.time_out
                        )}
                      </td>

                      <td>

                        <span
                          className={`attendance-status ${getStatusClass(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </main>

    </div>
  );
}