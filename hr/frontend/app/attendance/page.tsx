"use client";

import { useEffect, useState } from "react";
import HRISSidebar from "@/components/HRISSidebar";
import "./attendance.css";

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
  hire_date?: string | null;
  employment_status?: string;
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

type AttendanceForm = {
  employee_id: string;
  date: string;
  time_in: string;
  time_out: string;
  status: string;
};

type DailyAttendance = {
  employee_id: number;
  employee_name: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  status: string;
  attendance_id: number | null;
};

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingAttendance, setEditingAttendance] =
    useState<Attendance | null>(null);

  const [currentDate, setCurrentDate] = useState("");
  const [today, setToday] = useState("");

  // =========================
  // EMPLOYEE SEARCH
  // =========================

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] =
    useState(false);

  // =========================
  // EMPLOYEE HISTORY MODAL
  // =========================

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const [calendarMonth, setCalendarMonth] =
    useState<Date | null>(null);

  // =========================
  // FORM
  // =========================

  const [form, setForm] = useState<AttendanceForm>({
    employee_id: "",
    date: "",
    time_in: "",
    time_out: "",
    status: "Present",
  });

  // =========================
  // LOAD DATA
  // =========================

  useEffect(() => {
    const now = new Date();

    setCurrentDate(
      now.toLocaleDateString("en-US", {
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

    setCalendarMonth(now);

    fetchAttendance();
    fetchEmployees();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(
        `${API}/attendance/?_=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }

      const data = await response.json();

      setAttendance(data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API}/employees/`);

      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }

      const data = await response.json();

      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // =========================
  // DATE HELPERS
  // =========================

  const getTodayString = () => {
    const todayDate = new Date();

    const year = todayDate.getFullYear();
    const month = String(
      todayDate.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      todayDate.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";

    const cleanDate = String(dateString).substring(
      0,
      10
    );

    const parts = cleanDate.split("-");

    if (parts.length !== 3) {
      return "—";
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
      return "—";
    }

    const date = new Date(
      year,
      month - 1,
      day
    );

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatHireDate = (
    dateString?: string | null
  ) => {
    if (!dateString) return "Not available";

    return formatDate(dateString);
  };

  // =========================
  // TIME HELPER
  // =========================

  const formatTime = (time: string | null) => {
    if (!time) return "—";

    const parts = String(time).split(":");

    if (parts.length < 2) {
      return time;
    }

    let hour = Number(parts[0]);
    const minute = parts[1];

    if (Number.isNaN(hour)) {
      return time;
    }

    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;

    if (hour === 0) {
      hour = 12;
    }

    return `${hour}:${minute} ${ampm}`;
  };

  // =========================
  // FILTER EMPLOYEES
  // =========================

  const filteredEmployees = employees.filter(
    (employee) => {
      const fullName =
        `${employee.first_name} ${employee.last_name}`.toLowerCase();

      return fullName.includes(
        employeeSearch.toLowerCase()
      );
    }
  );

  // =========================
  // SELECT EMPLOYEE
  // =========================

  const selectEmployee = (
    employee: Employee
  ) => {
    setForm((prev) => ({
      ...prev,
      employee_id: String(
        employee.employee_id
      ),
    }));

    setEmployeeSearch(
      `${employee.first_name} ${employee.last_name}`
    );

    setShowEmployeeDropdown(false);
  };

  // =========================
  // ADD ATTENDANCE
  // =========================

  const openAddModal = () => {
    setEditingAttendance(null);

    setForm({
      employee_id: "",
      date: getTodayString(),
      time_in: "",
      time_out: "",
      status: "Present",
    });

    setEmployeeSearch("");
    setShowEmployeeDropdown(false);

    setShowModal(true);
  };

  const openAddForEmployee = (
    record: DailyAttendance
  ) => {
    setEditingAttendance(null);

    setForm({
      employee_id: String(
        record.employee_id
      ),
      date: getTodayString(),
      time_in: "",
      time_out: "",
      status: "Present",
    });

    setEmployeeSearch(
      record.employee_name
    );

    setShowEmployeeDropdown(false);

    setShowModal(true);
  };

  // =========================
  // EDIT ATTENDANCE
  // =========================

  const openEditModal = (
    record: Attendance
  ) => {
    setEditingAttendance(record);

    setForm({
      employee_id: String(
        record.employee_id
      ),
      date: String(record.date).substring(
        0,
        10
      ),
      time_in: record.time_in || "",
      time_out: record.time_out || "",
      status: record.status,
    });

    setEmployeeSearch(
      record.employee_name
    );

    setShowEmployeeDropdown(false);

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAttendance(null);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  // =========================
  // SAVE ATTENDANCE
  // =========================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!form.employee_id) {
      alert(
        "Please select an employee from the search results."
      );
      return;
    }

    try {
      const payload = {
        employee_id: Number(
          form.employee_id
        ),
        date: form.date,
        time_in: form.time_in || null,
        time_out:
          form.time_out || null,
        status: form.status,
      };

      let response;

      if (editingAttendance) {
        response = await fetch(
          `${API}/attendance/${editingAttendance.attendance_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              payload
            ),
          }
        );
      } else {
        response = await fetch(
          `${API}/attendance/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              payload
            ),
          }
        );
      }

      if (!response.ok) {
        const errorData =
          await response.json();

        console.error(
          "Backend error:",
          errorData
        );

        alert(
          errorData.detail ||
            "Something went wrong while saving attendance."
        );

        return;
      }

      closeModal();

      await fetchAttendance();
    } catch (error) {
      console.error(
        "Error saving attendance:",
        error
      );

      alert(
        "Could not connect to the backend."
      );
    }
  };

  // =========================
  // DELETE ATTENDANCE
  // =========================

  const deleteAttendance = async (
    attendanceId: number
  ) => {
    const confirmDelete = confirm(
      "Are you sure you want to delete this attendance record?"
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(
        `${API}/attendance/${attendanceId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to delete attendance"
        );
      }

      await fetchAttendance();
    } catch (error) {
      console.error(
        "Error deleting attendance:",
        error
      );

      alert(
        "Could not delete the attendance record."
      );
    }
  };

  // =========================
  // TODAY'S ATTENDANCE
  // ONE ROW PER EMPLOYEE
  // =========================

  const todayAttendance = employees
    .filter(
      (employee) =>
        employee.employment_status?.toLowerCase() !==
        "archived"
    )
    .map((employee) => {
      const employeeAttendance =
        attendance.find(
          (record) =>
            Number(
              record.employee_id
            ) ===
              Number(
                employee.employee_id
              ) &&
            String(
              record.date
            ).substring(0, 10) ===
              today
        );

      return {
        employee_id:
          employee.employee_id,

        employee_name:
          `${employee.first_name} ${employee.last_name}`,

        date: today,

        time_in:
          employeeAttendance?.time_in ||
          null,

        time_out:
          employeeAttendance?.time_out ||
          null,

        status:
          employeeAttendance?.status ||
          "Absent",

        attendance_id:
          employeeAttendance?.attendance_id ||
          null,
      };
    });

  // =========================
  // FILTER TODAY'S RECORDS
  // =========================

  const filteredAttendance =
    todayAttendance.filter(
      (record) => {
        const matchesSearch =
          record.employee_name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          record.status
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        const matchesStatus =
          statusFilter === "All" ||
          record.status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  // =========================
  // TODAY'S STATS
  // =========================

  const totalRecords =
    todayAttendance.length;

  const presentCount =
    todayAttendance.filter(
      (record) =>
        record.status ===
        "Present"
    ).length;

  const lateCount =
    todayAttendance.filter(
      (record) =>
        record.status === "Late"
    ).length;

  const absentCount =
    todayAttendance.filter(
      (record) =>
        record.status ===
        "Absent"
    ).length;

  // =========================
  // STATUS CLASS
  // =========================

  const getStatusClass = (
    status: string
  ) => {
    switch (
      status.toLowerCase()
    ) {
      case "present":
        return "status-present";

      case "late":
        return "status-late";

      case "absent":
        return "status-absent";

      case "leave":
        return "status-leave";

      default:
        return "";
    }
  };

  // =========================
  // INITIALS
  // =========================

  const getInitials = (
    name: string
  ) => {
    const parts =
      name.split(" ");

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name
      .substring(0, 2)
      .toUpperCase();
  };

  // =========================
  // OPEN EMPLOYEE HISTORY
  // =========================

  const openHistoryModal = (
    employeeId: number
  ) => {
    const employee =
      employees.find(
        (item) =>
          item.employee_id ===
          employeeId
      );

    if (!employee) return;

    setSelectedEmployee(
      employee
    );

    setCalendarMonth(
      new Date()
    );

    setShowHistoryModal(
      true
    );
  };

  const closeHistoryModal =
    () => {
      setShowHistoryModal(
        false
      );

      setSelectedEmployee(
        null
      );
    };

  // =========================
  // EMPLOYEE ATTENDANCE HISTORY
  // =========================

  const selectedEmployeeAttendance =
    selectedEmployee
      ? attendance.filter(
          (record) =>
            Number(
              record.employee_id
            ) ===
            Number(
              selectedEmployee.employee_id
            )
        )
      : [];

  // =========================
  // CALENDAR HELPERS
  // =========================

  const getDateKey = (
    year: number,
    month: number,
    day: number
  ) => {
    return `${year}-${String(
      month + 1
    ).padStart(
      2,
      "0"
    )}-${String(day).padStart(
      2,
      "0"
    )}`;
  };

  const getDaysInMonth = (
    year: number,
    month: number
  ) => {
    return new Date(
      year,
      month + 1,
      0
    ).getDate();
  };

  const getFirstDayOfMonth = (
    year: number,
    month: number
  ) => {
    return new Date(
      year,
      month,
      1
    ).getDay();
  };

  const getCalendarStatus = (
    dateKey: string
  ) => {
    const record =
      selectedEmployeeAttendance.find(
        (item) =>
          String(
            item.date
          ).substring(
            0,
            10
          ) === dateKey
      );

    if (record) {
      return record.status.toLowerCase();
    }

    return null;
  };

  const isBeforeHireDate = (
    dateKey: string
  ) => {
    if (
      !selectedEmployee?.hire_date
    ) {
      return false;
    }

    return (
      String(
        selectedEmployee.hire_date
      ).substring(
        0,
        10
      ) > dateKey
    );
  };

  const isFutureDate = (
    dateKey: string
  ) => {
    return dateKey > today;
  };

  const previousMonth = () => {
    if (!calendarMonth) return;

    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    if (!calendarMonth) return;

    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      )
    );
  };

  // =========================
  // CALENDAR VALUES
  // =========================

  const monthName =
    calendarMonth
      ? calendarMonth.toLocaleDateString(
          "en-US",
          {
            month: "long",
            year: "numeric",
          }
        )
      : "";

  const calendarDays: (
    number | null
  )[] = [];

  const calendarYear =
    calendarMonth
      ? calendarMonth.getFullYear()
      : 0;

  const calendarMonthNumber =
    calendarMonth
      ? calendarMonth.getMonth()
      : 0;

  const firstDay =
    calendarMonth
      ? getFirstDayOfMonth(
          calendarYear,
          calendarMonthNumber
        )
      : 0;

  const daysInMonth =
    calendarMonth
      ? getDaysInMonth(
          calendarYear,
          calendarMonthNumber
        )
      : 0;

  if (calendarMonth) {
    for (
      let i = 0;
      i < firstDay;
      i++
    ) {
      calendarDays.push(
        null
      );
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      calendarDays.push(
        day
      );
    }
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div className="attendance-page">

      <HRISSidebar />

      <main className="main-content">

        {/* HEADER */}
        <div className="page-header">

          <div>
            <h1>
              Attendance
            </h1>

            <p>
              Track and manage employee attendance records
            </p>
          </div>

          <div className="current-date">
            {currentDate}
          </div>

        </div>

        {/* STATS */}
        <div className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon blue">
              📋
            </div>

            <div>
              <span>
                Total Employees
              </span>

              <strong>
                {totalRecords}
              </strong>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon green">
              ✓
            </div>

            <div>
              <span>
                Present
              </span>

              <strong>
                {presentCount}
              </strong>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon orange">
              ⏰
            </div>

            <div>
              <span>
                Late
              </span>

              <strong>
                {lateCount}
              </strong>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon red">
              ✕
            </div>

            <div>
              <span>
                Absent
              </span>

              <strong>
                {absentCount}
              </strong>
            </div>

          </div>

        </div>

        {/* RECORDS */}
        <section className="record-card">

          <div className="record-header">

            <div>
              <h2>
                Today's Attendance
              </h2>

              <p>
                Showing one attendance record for each employee
              </p>
            </div>

            <button
              className="add-button"
              onClick={
                openAddModal
              }
            >
              + Add Attendance
            </button>

          </div>

          {/* FILTERS */}
          <div className="filters">

            <div className="search-box">

              <span>
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search employee or status..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

            </div>

            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Status
              </option>

              <option value="Present">
                Present
              </option>

              <option value="Late">
                Late
              </option>

              <option value="Absent">
                Absent
              </option>

              <option value="Leave">
                Leave
              </option>

            </select>

          </div>

          {/* TABLE */}
          <div className="table-wrapper">

            <table>

              <thead>

                <tr>
                  <th>
                    EMPLOYEE
                  </th>

                  <th>
                    DATE
                  </th>

                  <th>
                    TIME IN
                  </th>

                  <th>
                    TIME OUT
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    ACTIONS
                  </th>
                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>

                    <td
                      colSpan={6}
                      className="empty-message"
                    >
                      Loading attendance records...
                    </td>

                  </tr>
                ) : filteredAttendance.length === 0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="empty-message"
                    >
                      No employees found.
                    </td>

                  </tr>

                ) : (

                  filteredAttendance.map(
                    (record) => (

                      <tr
                        key={
                          record.employee_id
                        }
                      >

                        {/* EMPLOYEE */}
                        <td>

                          <div
                            className="employee-cell clickable-employee"
                            onClick={() =>
                              openHistoryModal(
                                record.employee_id
                              )
                            }
                            title="View attendance history"
                          >

                            <div className="employee-avatar">

                              {getInitials(
                                record.employee_name
                              )}

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

                        {/* DATE */}
                        <td>
                          {formatDate(
                            record.date
                          )}
                        </td>

                        {/* TIME IN */}
                        <td>
                          {formatTime(
                            record.time_in
                          )}
                        </td>

                        {/* TIME OUT */}
                        <td>
                          {formatTime(
                            record.time_out
                          )}
                        </td>

                        {/* STATUS */}
                        <td>

                          <span
                            className={`status-pill ${getStatusClass(
                              record.status
                            )}`}
                          >
                            {
                              record.status
                            }
                          </span>

                        </td>

                        {/* ACTIONS */}
                        <td>

                          <div className="actions">

                            {record.attendance_id ? (
                              <>

                                <button
                                  className="edit-btn"
                                  onClick={() => {

                                    const fullRecord =
                                      attendance.find(
                                        (item) =>
                                          item.attendance_id ===
                                          record.attendance_id
                                      );

                                    if (
                                      fullRecord
                                    ) {
                                      openEditModal(
                                        fullRecord
                                      );
                                    }

                                  }}
                                >
                                  Edit
                                </button>

                                <button
                                  className="delete-btn"
                                  onClick={() =>
                                    deleteAttendance(
                                      record.attendance_id!
                                    )
                                  }
                                >
                                  Delete
                                </button>

                              </>

                            ) : (

                              <button
                                className="add-small-btn"
                                onClick={() =>
                                  openAddForEmployee(
                                    record
                                  )
                                }
                              >
                                Add
                              </button>

                            )}

                          </div>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </section>

      </main>

      {/* =========================
          ADD / EDIT MODAL
      ========================= */}

      {showModal && (
        <div
          className="modal-overlay"
          onClick={
            closeModal
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>
                  {editingAttendance
                    ? "Edit Attendance"
                    : "Add Attendance"}
                </h2>

                <p>
                  {editingAttendance
                    ? "Update the attendance record"
                    : "Create a new attendance record"}
                </p>

              </div>

              <button
                className="close-button"
                onClick={
                  closeModal
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >

              <div className="form-grid">

                {/* EMPLOYEE SEARCH */}
                <div className="form-group employee-search-group">

                  <label>
                    Employee *
                  </label>

                  <div className="employee-search-wrapper">

                    <input
                      type="text"
                      placeholder="Type employee name..."
                      value={
                        employeeSearch
                      }
                      onChange={(e) => {

                        const value =
                          e.target.value;

                        setEmployeeSearch(
                          value
                        );

                        setForm(
                          (prev) => ({
                            ...prev,
                            employee_id:
                              "",
                          })
                        );

                        setShowEmployeeDropdown(
                          value.length >
                            0
                        );

                      }}
                      onFocus={() => {

                        if (
                          employeeSearch
                        ) {
                          setShowEmployeeDropdown(
                            true
                          );
                        }

                      }}
                      required={
                        !form.employee_id
                      }
                    />

                    {showEmployeeDropdown &&
                      employeeSearch && (

                        <div className="employee-dropdown">

                          {filteredEmployees.length >
                          0 ? (

                            filteredEmployees.map(
                              (
                                employee
                              ) => (

                                <div
                                  key={
                                    employee.employee_id
                                  }
                                  className="employee-option"
                                  onMouseDown={(
                                    e
                                  ) => {

                                    e.preventDefault();

                                    selectEmployee(
                                      employee
                                    );

                                  }}
                                >

                                  <div className="employee-option-avatar">

                                    {
                                      employee
                                        .first_name[0]
                                    }

                                    {
                                      employee
                                        .last_name[0]
                                    }

                                  </div>

                                  <div>

                                    <strong>
                                      {
                                        employee.first_name
                                      }{" "}
                                      {
                                        employee.last_name
                                      }
                                    </strong>

                                    <small>
                                      Employee #
                                      {
                                        employee.employee_id
                                      }
                                    </small>

                                  </div>

                                </div>

                              )
                            )

                          ) : (

                            <div className="no-employees">
                              No employees found
                            </div>

                          )}

                        </div>

                      )}

                  </div>

                  {form.employee_id && (

                    <small className="selected-employee">

                      Selected employee ID:{" "}
                      {
                        form.employee_id
                      }

                    </small>

                  )}

                </div>

                {/* DATE */}
                <div className="form-group">

                  <label>
                    Date *
                  </label>

                  <input
                    type="date"
                    value={
                      form.date
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        date: e.target.value,
                      })
                    }
                    required
                  />

                </div>

                {/* TIME IN */}
                <div className="form-group">

                  <label>
                    Time In
                  </label>

                  <input
                    type="time"
                    value={
                      form.time_in
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        time_in:
                          e.target.value,
                      })
                    }
                  />

                </div>

                {/* TIME OUT */}
                <div className="form-group">

                  <label>
                    Time Out
                  </label>

                  <input
                    type="time"
                    value={
                      form.time_out
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        time_out:
                          e.target.value,
                      })
                    }
                  />

                </div>

                {/* STATUS */}
                <div className="form-group">

                  <label>
                    Status *
                  </label>

                  <select
                    value={
                      form.status
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status:
                          e.target.value,
                      })
                    }
                    required
                  >

                    <option value="Present">
                      Present
                    </option>

                    <option value="Late">
                      Late
                    </option>

                    <option value="Absent">
                      Absent
                    </option>

                    <option value="Leave">
                      Leave
                    </option>

                  </select>

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={
                    closeModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                >
                  {editingAttendance
                    ? "Update Attendance"
                    : "Save Attendance"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =========================
          EMPLOYEE HISTORY MODAL
      ========================= */}

      {showHistoryModal &&
        selectedEmployee && (
          <div
            className="modal-overlay history-overlay"
            onClick={
              closeHistoryModal
            }
          >

            <div
              className="history-modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* HEADER */}
              <div className="history-header">

                <div className="history-employee">

                  <div className="history-avatar">

                    {getInitials(
                      `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                    )}

                  </div>

                  <div>

                    <h2>
                      {
                        selectedEmployee.first_name
                      }{" "}
                      {
                        selectedEmployee.last_name
                      }
                    </h2>

                    <p>
                      Employee #
                      {
                        selectedEmployee.employee_id
                      }
                    </p>

                  </div>

                </div>

                <button
                  className="close-button"
                  onClick={
                    closeHistoryModal
                  }
                >
                  ×
                </button>

              </div>

              {/* EMPLOYEE INFO */}
              <div className="employee-info">

                <div className="info-box">

                  <span>
                    STARTED WORKING
                  </span>

                  <strong>
                    {formatHireDate(
                      selectedEmployee.hire_date
                    )}
                  </strong>

                </div>

                <div className="info-box">

                  <span>
                    TOTAL ATTENDANCE RECORDS
                  </span>

                  <strong>
                    {
                      selectedEmployeeAttendance.length
                    }
                  </strong>

                </div>

              </div>

              {/* CALENDAR */}
              <div className="calendar-section">

                <div className="calendar-header">

                  <button
                    className="month-button"
                    onClick={
                      previousMonth
                    }
                  >
                    ‹
                  </button>

                  <h3>
                    {monthName}
                  </h3>

                  <button
                    className="month-button"
                    onClick={
                      nextMonth
                    }
                  >
                    ›
                  </button>

                </div>

                <div className="calendar-weekdays">

                  <div>
                    Sun
                  </div>

                  <div>
                    Mon
                  </div>

                  <div>
                    Tue
                  </div>

                  <div>
                    Wed
                  </div>

                  <div>
                    Thu
                  </div>

                  <div>
                    Fri
                  </div>

                  <div>
                    Sat
                  </div>

                </div>

                <div className="calendar-grid">

                  {calendarDays.map(
                    (
                      day,
                      index
                    ) => {

                      if (
                        day ===
                        null
                      ) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="calendar-day empty"
                          />
                        );
                      }

                      const dateKey =
                        getDateKey(
                          calendarYear,
                          calendarMonthNumber,
                          day
                        );

                      const status =
                        getCalendarStatus(
                          dateKey
                        );

                      const beforeHire =
                        isBeforeHireDate(
                          dateKey
                        );

                      const future =
                        isFutureDate(
                          dateKey
                        );

                      let dayClass =
                        "calendar-day";

                      if (
                        beforeHire
                      ) {
                        dayClass +=
                          " before-hire";
                      } else if (
                        future
                      ) {
                        dayClass +=
                          " future-day";
                      } else if (
                        status ===
                        "present"
                      ) {
                        dayClass +=
                          " present-day";
                      } else if (
                        status ===
                        "late"
                      ) {
                        dayClass +=
                          " late-day";
                      } else if (
                        status ===
                        "absent"
                      ) {
                        dayClass +=
                          " absent-day";
                      } else if (
                        status ===
                        "leave"
                      ) {
                        dayClass +=
                          " leave-day";
                      } else {
                        dayClass +=
                          " no-record-day";
                      }

                      return (
                        <div
                          key={
                            dateKey
                          }
                          className={
                            dayClass
                          }
                        >

                          <span className="calendar-date-number">
                            {
                              day
                            }
                          </span>

                          {!beforeHire &&
                            !future && (

                              <span className="calendar-status">

                                {status ===
                                "present"
                                  ? "Present"
                                  : status ===
                                    "late"
                                  ? "Late"
                                  : status ===
                                    "absent"
                                  ? "Absent"
                                  : status ===
                                    "leave"
                                  ? "Leave"
                                  : "No Record"}

                              </span>

                            )}

                        </div>
                      );
                    }
                  )}

                </div>

                {/* LEGEND */}
                <div className="calendar-legend">

                  <div>
                    <span className="legend-dot present-dot" />
                    Present
                  </div>

                  <div>
                    <span className="legend-dot late-dot" />
                    Late
                  </div>

                  <div>
                    <span className="legend-dot absent-dot" />
                    Absent
                  </div>

                  <div>
                    <span className="legend-dot leave-dot" />
                    Leave
                  </div>

                  <div>
                    <span className="legend-dot no-record-dot" />
                    No Record
                  </div>

                </div>

              </div>

              {/* CLOSE */}
              <div className="history-footer">

                <button
                  className="cancel-button"
                  onClick={
                    closeHistoryModal
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}