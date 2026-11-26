"use client";

import { useEffect, useState } from "react";
import HRISSidebar from "@/components/HRISSidebar";
import "./leave.css";

type Leave = {
  leave_id: number;
  employee_id: number;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
};

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function LeavePage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("All");

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await fetch(`${API}/leave/`);

      if (!response.ok) {
        throw new Error("Failed to fetch leaves");
      }

      const data = await response.json();
      setLeaves(data);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  };

  // APPROVE OR REJECT LEAVE
  const updateLeaveStatus = async (
    leave: Leave,
    newStatus: "Approved" | "Rejected"
  ) => {
    const action = newStatus === "Approved" ? "approve" : "reject";

    const confirmAction = confirm(
      `Are you sure you want to ${action} this leave request?`
    );

    if (!confirmAction) return;

    setActionLoading(leave.leave_id);

    try {
      const payload = {
        employee_id: leave.employee_id,
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        reason: leave.reason || "",
        status: newStatus,
      };

      const response = await fetch(
        `${API}/leave/${leave.leave_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        console.error("Backend error:", errorData);

        alert(
          errorData.detail ||
            `Could not ${action} the leave request.`
        );

        return;
      }

      await fetchLeaves();
    } catch (error) {
      console.error(`Error trying to ${action} leave:`, error);

      alert("Could not connect to the backend.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredLeaves = leaves.filter((leave) => {
    const employeeName = leave.employee_name || "";
    const leaveType = leave.leave_type || "";
    const status = leave.status || "";

    const matchesSearch =
      employeeName
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      leaveType
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" ||
      status === statusFilter;

    const matchesLeaveType =
      leaveTypeFilter === "All" ||
      leaveType === leaveTypeFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesLeaveType
    );
  });

  const totalRequests = leaves.length;

  const pendingCount = leaves.filter(
    (leave) => leave.status === "Pending"
  ).length;

  const approvedCount = leaves.filter(
    (leave) => leave.status === "Approved"
  ).length;

  const rejectedCount = leaves.filter(
    (leave) => leave.status === "Rejected"
  ).length;

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "status-approved";

      case "pending":
        return "status-pending";

      case "rejected":
        return "status-rejected";

      default:
        return "";
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (date: string) => {
    if (!date) return "—";

    const dateOnly = String(date).substring(0, 10);
    const parts = dateOnly.split("-");

    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      const localDate = new Date(year, month - 1, day);

      return localDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return date;
  };

  return (
    <div className="leave-page">

      {/* SHARED HRIS SIDEBAR */}
      <HRISSidebar />

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* PAGE HEADER */}
        <div className="page-header">
          <div>
            <h1>Leave Management</h1>

            <p>
              Review and manage employee leave requests
            </p>
          </div>

          <div className="current-date">
            {currentDate}
          </div>
        </div>

        {/* STATISTICS */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-icon blue">
              📋
            </div>

            <div>
              <span>Total Requests</span>
              <strong>{totalRequests}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              ⏳
            </div>

            <div>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              ✓
            </div>

            <div>
              <span>Approved</span>
              <strong>{approvedCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon red">
              ✕
            </div>

            <div>
              <span>Rejected</span>
              <strong>{rejectedCount}</strong>
            </div>
          </div>

        </div>

        {/* RECORDS */}
        <section className="record-card">

          <div className="record-header">
            <div>
              <h2>Leave Requests</h2>

              <p>
                Review employee leave applications and
                approve or reject requests
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <div className="filters">

            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search employee or leave type..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >
              <option value="All">
                All Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Approved">
                Approved
              </option>

              <option value="Rejected">
                Rejected
              </option>
            </select>

            <select
              value={leaveTypeFilter}
              onChange={(e) =>
                setLeaveTypeFilter(e.target.value)
              }
            >
              <option value="All">
                All Leave Types
              </option>

              <option value="Vacation Leave">
                Vacation Leave
              </option>

              <option value="Sick Leave">
                Sick Leave
              </option>

              <option value="Emergency Leave">
                Emergency Leave
              </option>

              <option value="Maternity Leave">
                Maternity Leave
              </option>

              <option value="Paternity Leave">
                Paternity Leave
              </option>
            </select>

          </div>

          {/* TABLE */}
          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>LEAVE TYPE</th>
                  <th>START DATE</th>
                  <th>END DATE</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="empty-message"
                    >
                      Loading leave requests...
                    </td>
                  </tr>

                ) : filteredLeaves.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="empty-message"
                    >
                      No leave requests found.
                    </td>
                  </tr>

                ) : (
                  filteredLeaves.map((leave) => (

                    <tr key={leave.leave_id}>

                      {/* EMPLOYEE */}
                      <td>
                        <div className="employee-cell">

                          <div className="employee-avatar">
                            {getInitials(
                              leave.employee_name
                            )}
                          </div>

                          <div>
                            <strong>
                              {leave.employee_name}
                            </strong>

                            <span>
                              Employee #
                              {leave.employee_id}
                            </span>
                          </div>

                        </div>
                      </td>

                      {/* LEAVE TYPE */}
                      <td>
                        {leave.leave_type}
                      </td>

                      {/* START DATE */}
                      <td>
                        {formatDate(
                          leave.start_date
                        )}
                      </td>

                      {/* END DATE */}
                      <td>
                        {formatDate(
                          leave.end_date
                        )}
                      </td>

                      {/* REASON */}
                      <td>
                        <span className="reason-text">
                          {leave.reason || "—"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span
                          className={`status-pill ${getStatusClass(
                            leave.status
                          )}`}
                        >
                          {leave.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td>

                        {leave.status === "Pending" ? (

                          <div className="actions">

                            <button
                              className="approve-btn"
                              onClick={() =>
                                updateLeaveStatus(
                                  leave,
                                  "Approved"
                                )
                              }
                              disabled={
                                actionLoading ===
                                leave.leave_id
                              }
                            >
                              {actionLoading ===
                              leave.leave_id
                                ? "Processing..."
                                : "Approve"}
                            </button>

                            <button
                              className="reject-btn"
                              onClick={() =>
                                updateLeaveStatus(
                                  leave,
                                  "Rejected"
                                )
                              }
                              disabled={
                                actionLoading ===
                                leave.leave_id
                              }
                            >
                              {actionLoading ===
                              leave.leave_id
                                ? "Processing..."
                                : "Reject"}
                            </button>

                          </div>

                        ) : (

                          <span className="no-action">
                            No action needed
                          </span>

                        )}

                      </td>

                    </tr>

                  ))
                )}

              </tbody>

            </table>

          </div>

        </section>

      </main>

    </div>
  );
}