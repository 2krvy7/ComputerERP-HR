"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/EmployeeSidebar";
import "./employee-leave.css";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Temporary employee ID.
// Later this will come from the logged-in employee.
const CURRENT_EMPLOYEE_ID = 2;

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

type LeaveForm = {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
};

export default function EmployeeLeavePage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  // Current date
  const [currentDate, setCurrentDate] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<LeaveForm>({
    leave_type: "Vacation Leave",
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    // Set current date after the component has mounted.
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );

    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await fetch(`${API}/leave/`);

      if (!response.ok) {
        throw new Error("Failed to fetch leave records");
      }

      const data = await response.json();

      const myLeaves = data.filter(
        (record: Leave) =>
          Number(record.employee_id) === CURRENT_EMPLOYEE_ID
      );

      setLeaves(myLeaves);
    } catch (error) {
      console.error("Error fetching leave records:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.start_date ||
      !form.end_date ||
      !form.reason.trim()
    ) {
      alert("Please complete all required fields.");
      return;
    }

    if (form.end_date < form.start_date) {
      alert("End date cannot be earlier than the start date.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API}/leave/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: CURRENT_EMPLOYEE_ID,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason,
          status: "Pending",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(
          errorData?.detail || "Failed to submit leave request"
        );
      }

      alert("Leave request submitted successfully!");

      setForm({
        leave_type: "Vacation Leave",
        start_date: "",
        end_date: "",
        reason: "",
      });

      setShowModal(false);

      await fetchLeaves();
    } catch (error) {
      console.error("Error submitting leave request:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit leave request."
      );
    } finally {
      setSaving(false);
    }
  };

  const pendingLeaves = leaves.filter(
    (leave) =>
      leave.status?.toLowerCase() === "pending"
  ).length;

  const approvedLeaves = leaves.filter(
    (leave) =>
      leave.status?.toLowerCase() === "approved"
  ).length;

  const rejectedLeaves = leaves.filter(
    (leave) =>
      leave.status?.toLowerCase() === "rejected"
  ).length;

  const formatDate = (date: string) => {
    if (!date) return "--";

    const dateOnly = String(date).substring(0, 10);
    const parts = dateOnly.split("-");

    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      const localDate = new Date(
        year,
        month - 1,
        day
      );

      return localDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return date;
  };

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "status-pending";

      case "approved":
        return "status-approved";

      case "rejected":
        return "status-rejected";

      default:
        return "status-default";
    }
  };

  return (
    <div className="employee-page">

      {/* SHARED EMPLOYEE SIDEBAR */}
      <EmployeeSidebar
        username="Employee User"
        userId={`EMP-${String(CURRENT_EMPLOYEE_ID).padStart(3, "0")}`}
        role="Employee"
      />

      {/* MAIN CONTENT */}
      <main className="employee-main">

        {/* HEADER */}
        <header className="employee-header">

          <div>
            <h1>My Leave</h1>

            <p>
              View your leave requests and submit a new leave application.
            </p>
          </div>

          <div className="employee-date">
            {currentDate}
          </div>

        </header>

        {/* STATS */}
        <section className="leave-stats">

          <div className="leave-stat-card">
            <div className="stat-icon">📋</div>

            <div>
              <span>Total Requests</span>
              <strong>{leaves.length}</strong>
            </div>
          </div>

          <div className="leave-stat-card">
            <div className="stat-icon">⏳</div>

            <div>
              <span>Pending</span>
              <strong>{pendingLeaves}</strong>
            </div>
          </div>

          <div className="leave-stat-card">
            <div className="stat-icon">✓</div>

            <div>
              <span>Approved</span>
              <strong>{approvedLeaves}</strong>
            </div>
          </div>

          <div className="leave-stat-card">
            <div className="stat-icon">✕</div>

            <div>
              <span>Rejected</span>
              <strong>{rejectedLeaves}</strong>
            </div>
          </div>

        </section>

        {/* RECORD CARD */}
        <section className="leave-record-card">

          <div className="record-header">

            <div>
              <h2>My Leave Requests</h2>

              <p>
                Your submitted leave applications
              </p>
            </div>

            <button
              className="apply-leave-button"
              onClick={() => setShowModal(true)}
            >
              + Apply for Leave
            </button>

          </div>

          {/* TABLE */}
          {loading ? (

            <div className="leave-empty">

              <div className="loading-spinner"></div>

              <p>
                Loading leave records...
              </p>

            </div>

          ) : leaves.length === 0 ? (

            <div className="leave-empty">

              <div className="empty-icon">
                📅
              </div>

              <h3>
                No Leave Requests
              </h3>

              <p>
                You have not submitted any leave requests yet.
              </p>

            </div>

          ) : (

            <div className="leave-table-wrapper">

              <table className="leave-table">

                <thead>
                  <tr>
                    <th>LEAVE TYPE</th>
                    <th>START DATE</th>
                    <th>END DATE</th>
                    <th>REASON</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>

                  {leaves.map((leave) => (

                    <tr key={leave.leave_id}>

                      <td>
                        <div className="leave-type-cell">

                          <div className="leave-icon">
                            📅
                          </div>

                          <strong>
                            {leave.leave_type}
                          </strong>

                        </div>
                      </td>

                      <td>
                        {formatDate(leave.start_date)}
                      </td>

                      <td>
                        {formatDate(leave.end_date)}
                      </td>

                      <td>
                        <div className="reason-cell">
                          {leave.reason}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`leave-status ${getStatusClass(
                            leave.status
                          )}`}
                        >
                          {leave.status}
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

      {/* APPLY LEAVE MODAL */}
      {showModal && (

        <div
          className="modal-overlay"
          onClick={() => {
            if (!saving) {
              setShowModal(false);
            }
          }}
        >

          <div
            className="leave-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">

              <div>
                <h2>Apply for Leave</h2>

                <p>
                  Submit a new leave request.
                </p>
              </div>

              <button
                className="close-button"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="form-group">

                <label>
                  Leave Type
                </label>

                <select
                  name="leave_type"
                  value={form.leave_type}
                  onChange={handleChange}
                >
                  <option value="Vacation Leave">
                    Vacation Leave
                  </option>

                  <option value="Sick Leave">
                    Sick Leave
                  </option>

                  <option value="Emergency Leave">
                    Emergency Leave
                  </option>

                  <option value="Personal Leave">
                    Personal Leave
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Start Date
                  </label>

                  <input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    End Date
                  </label>

                  <input
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    required
                  />

                </div>

              </div>

              <div className="form-group">

                <label>
                  Reason
                </label>

                <textarea
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="Enter the reason for your leave..."
                  rows={4}
                  required
                />

              </div>

              <div className="form-note">
                Your leave request will be submitted with a
                <strong> Pending </strong>
                status for HR approval.
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={saving}
                >
                  {saving
                    ? "Submitting..."
                    : "Submit Request"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}