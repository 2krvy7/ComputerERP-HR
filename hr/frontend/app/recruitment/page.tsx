"use client";

import HRISSidebar from "@/components/HRISSidebar";
import { useEffect, useState } from "react";
import "./recruitment.css";

const API = "http://127.0.0.1:8000";

type Applicant = {
  applicant_id: number;
  first_name: string;
  last_name: string;
  birth_date?: string;
  email: string;
  contact_no: string;
  address?: string;
  application_date: string;
  status: string;
};

type Position = {
  position_id: number;
  position_name: string;
};

type Recruitment = {
  recruitment_id: number;
  applicant_id: number;
  first_name: string;
  last_name: string;
  applicant_name: string;
  birth_date: string;
  email: string;
  contact_no: string;
  address: string;
  application_date: string;
  position_id: number;
  position_name: string;
  interview_date: string | null;
  result: string | null;
  recruitment_status: string;
};

type ApplicantForm = {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
  contact_no: string;
  address: string;
  application_date: string;
  position_id: string;
  interview_date: string;
  result: string;
  recruitment_status: string;
};

// =========================
// CAPITALIZE NAME
// =========================

const capitalizeName = (name: string) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function RecruitmentPage() {
  const [recruitments, setRecruitments] = useState<Recruitment[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Direct recruitment process editing
  const [editingProcessId, setEditingProcessId] =
    useState<number | null>(null);

  const [interviewDateDraft, setInterviewDateDraft] =
    useState("");

  const [resultDraft, setResultDraft] =
    useState("Pending");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");

  const [applicantSearch, setApplicantSearch] = useState("");
  const [showApplicantDropdown, setShowApplicantDropdown] =
    useState(false);

  const [currentDate, setCurrentDate] = useState("");

  const [form, setForm] = useState<ApplicantForm>({
    first_name: "",
    last_name: "",
    birth_date: "",
    email: "",
    contact_no: "",
    address: "",
    application_date: "",
    position_id: "",
    interview_date: "",
    result: "Pending",
    recruitment_status: "Pending",
  });

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [recruitmentResponse, positionsResponse] =
        await Promise.all([
          fetch(`${API}/recruitment/`),
          fetch(`${API}/positions/`),
        ]);

      if (recruitmentResponse.ok) {
        const data = await recruitmentResponse.json();
        setRecruitments(data);
      }

      if (positionsResponse.ok) {
        const data = await positionsResponse.json();
        setPositions(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // FILTER RECRUITMENTS
  // =========================

  const filteredRecruitments = recruitments.filter((item) => {
    const matchesSearch =
      item.applicant_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      item.email
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      !statusFilter ||
      item.recruitment_status === statusFilter;

    const matchesPosition =
      !positionFilter ||
      String(item.position_id) === positionFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPosition
    );
  });

  // =========================
  // STATISTICS
  // =========================

  const pendingCount = recruitments.filter(
    (item) =>
      item.recruitment_status === "Pending"
  ).length;

  const interviewCount = recruitments.filter(
    (item) =>
      item.recruitment_status === "For Interview"
  ).length;

  const hiredCount = recruitments.filter(
    (item) =>
      item.recruitment_status === "Hired"
  ).length;

  // =========================
  // FILTER APPLICANTS
  // =========================

  const filteredApplicants = applicants.filter(
    (applicant) => {
      const fullName =
        `${applicant.first_name} ${applicant.last_name}`
          .toLowerCase();

      return (
        fullName.includes(
          applicantSearch.toLowerCase()
        ) ||
        applicant.email
          .toLowerCase()
          .includes(
            applicantSearch.toLowerCase()
          )
      );
    }
  );

  // =========================
  // AUTOMATIC STATUS
  // =========================

  const getAutomaticStatus = () => {
    if (!form.interview_date) {
      return "Pending";
    }

    if (form.result === "Passed") {
      return "Hired";
    }

    if (form.result === "Failed") {
      return "Rejected";
    }

    return "For Interview";
  };

  // =========================
  // DIRECT PROCESS STATUS
  // =========================

  const getProcessStatus = (
    interviewDate: string,
    result: string
  ) => {
    if (!interviewDate) {
      return "Pending";
    }

    if (result === "Passed") {
      return "Hired";
    }

    if (result === "Failed") {
      return "Rejected";
    }

    return "For Interview";
  };

  // =========================
  // ADD APPLICANT
  // =========================

  const openAddModal = () => {
    setEditingId(null);

    setForm({
      first_name: "",
      last_name: "",
      birth_date: "",
      email: "",
      contact_no: "",
      address: "",
      application_date:
        new Date()
          .toISOString()
          .split("T")[0],
      position_id: "",
      interview_date: "",
      result: "Pending",
      recruitment_status: "Pending",
    });

    setShowModal(true);
  };

  // =========================
  // EDIT APPLICANT DETAILS
  // =========================

  const openEditModal = (
    item: Recruitment
  ) => {
    setEditingId(
      item.recruitment_id
    );

    setForm({
      first_name:
        item.first_name ||
        item.applicant_name
          ?.split(" ")[0] ||
        "",

      last_name:
        item.last_name ||
        item.applicant_name
          ?.split(" ")
          .slice(1)
          .join(" ") ||
        "",

      birth_date:
        item.birth_date || "",

      email:
        item.email || "",

      contact_no:
        item.contact_no || "",

      address:
        item.address || "",

      application_date:
        item.application_date || "",

      position_id:
        String(item.position_id),

      interview_date:
        item.interview_date || "",

      result:
        item.result || "Pending",

      recruitment_status:
        item.recruitment_status,
    });

    setShowModal(true);
  };

  // =========================
  // SAVE APPLICANT / RECRUITMENT
  // =========================

  const saveApplicantAndRecruitment =
    async () => {

      if (
        !form.first_name.trim() ||
        !form.last_name.trim() ||
        !form.birth_date ||
        !form.email.trim() ||
        !form.contact_no.trim() ||
        !form.address.trim()
      ) {
        alert(
          "Please fill in all required employee details."
        );
        return;
      }

      try {

        // =========================
        // EDIT EXISTING RECRUITMENT
        // =========================

        if (editingId) {

          const currentRecruitment =
            recruitments.find(
              (item) =>
                item.recruitment_id ===
                editingId
            );

          if (!currentRecruitment) {
            throw new Error(
              "Recruitment record was not found."
            );
          }

          const recruitmentResponse =
            await fetch(
              `${API}/recruitment/${editingId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  applicant_id:
                    currentRecruitment.applicant_id,

                  first_name:
                    capitalizeName(
                      form.first_name
                    ),

                  last_name:
                    capitalizeName(
                      form.last_name
                    ),

                  birth_date:
                    form.birth_date,

                  email:
                    form.email.trim(),

                  contact_no:
                    form.contact_no.trim(),

                  address:
                    form.address.trim(),

                  interview_date:
                    form.interview_date ||
                    null,

                  result:
                    form.result ||
                    null,
                }),
              }
            );

          if (!recruitmentResponse.ok) {

            const errorData =
              await recruitmentResponse.json();

            throw new Error(
              errorData.detail ||
                "Failed to update recruitment."
            );
          }

          alert(
            "Recruitment updated successfully!"
          );

          setShowModal(false);
          setEditingId(null);

          await fetchData();

          return;
        }

        // =========================
        // CREATE RECRUITMENT
        // =========================

        const recruitmentResponse =
          await fetch(
            `${API}/recruitment/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                first_name:
                  capitalizeName(
                    form.first_name
                  ),

                last_name:
                  capitalizeName(
                    form.last_name
                  ),

                birth_date:
                  form.birth_date,

                email:
                  form.email.trim(),

                contact_no:
                  form.contact_no.trim(),

                address:
                  form.address.trim(),

                interview_date:
                  form.interview_date ||
                  null,

                result:
                  form.result ||
                  null,
              }),
            }
          );

        if (!recruitmentResponse.ok) {

          const errorData =
            await recruitmentResponse.json();

          throw new Error(
            errorData.detail ||
              "Failed to create recruitment record."
          );
        }

        await recruitmentResponse.json();

        alert(
          "Applicant and recruitment record added successfully!"
        );

        setShowModal(false);

        setForm({
          first_name: "",
          last_name: "",
          birth_date: "",
          email: "",
          contact_no: "",
          address: "",
          application_date:
            new Date()
              .toISOString()
              .split("T")[0],
          position_id: "",
          interview_date: "",
          result: "Pending",
          recruitment_status:
            "Pending",
        });

        await fetchData();

      } catch (error: any) {

        console.error(
          "Save recruitment error:",
          error
        );

        alert(
          error.message ||
            "Something went wrong."
        );
      }
    };

  // =========================
  // START DIRECT PROCESS EDIT
  // =========================

  const startProcessEdit = (
    item: Recruitment
  ) => {

    setEditingProcessId(
      item.recruitment_id
    );

    setInterviewDateDraft(
      item.interview_date || ""
    );

    setResultDraft(
      item.result || "Pending"
    );
  };

  // =========================
  // CANCEL DIRECT PROCESS EDIT
  // =========================

  const cancelProcessEdit = () => {

    setEditingProcessId(null);

    setInterviewDateDraft("");

    setResultDraft("Pending");
  };

  // =========================
  // SAVE DIRECT PROCESS
  // =========================

  const saveProcessEdit = async (
    item: Recruitment
  ) => {

    try {

      const response = await fetch(
        `${API}/recruitment/${item.recruitment_id}/process`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            interview_date:
              interviewDateDraft ||
              null,

            result:
              resultDraft ||
              null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
            "Failed to update recruitment process."
        );
      }

      setEditingProcessId(null);

      setInterviewDateDraft("");

      setResultDraft("Pending");

      await fetchData();

    } catch (error: any) {

      console.error(
        "Update recruitment process error:",
        error
      );

      alert(
        error.message ||
          "Something went wrong."
      );
    }
  };

  // =========================
  // DELETE RECRUITMENT
  // =========================

  const deleteRecruitment = async (
    id: number
  ) => {

    const confirmed =
      confirm(
        "Are you sure you want to delete this recruitment record?"
      );

    if (!confirmed) return;

    try {

      const response =
        await fetch(
          `${API}/recruitment/${id}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {

        const errorData =
          await response.json();

        throw new Error(
          errorData.detail ||
            "Failed to delete recruitment."
        );
      }

      alert(
        "Recruitment deleted successfully!"
      );

      await fetchData();

    } catch (error: any) {

      alert(
        error.message ||
          "Something went wrong."
      );
    }
  };

  // =========================
  // CREATE EMPLOYEE
  // =========================

  const createEmployee = async (
    item: Recruitment
  ) => {

    const confirmed =
      confirm(
        `Create an employee record for ${capitalizeName(
          item.applicant_name
        )}?`
      );

    if (!confirmed) return;

    try {

      /*
       * UserID is intentionally NOT included.
       * Employee will be created with NULL UserID.
       * Superadmin will assign UserID later.
       */

      const employeePayload = {

        position_id:
          item.position_id,

        first_name:
          capitalizeName(
            item.first_name ||
            item.applicant_name
              ?.split(" ")[0] ||
            ""
          ),

        last_name:
          capitalizeName(
            item.last_name ||
            item.applicant_name
              ?.split(" ")
              .slice(1)
              .join(" ") ||
            ""
          ),

        birth_date:
          item.birth_date ||
          null,

        contact_no:
          item.contact_no ||
          "",

        email:
          item.email ||
          "",

        address:
          item.address ||
          "",

        hire_date:
          new Date()
            .toISOString()
            .split("T")[0],

        employment_status:
          "Active",
      };

      // =========================
      // CREATE EMPLOYEE
      // =========================

      const employeeResponse =
        await fetch(
          `${API}/employees/`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              employeePayload
            ),
          }
        );

      const employeeData =
        await employeeResponse.json();

      if (!employeeResponse.ok) {

        let errorMessage =
          "Failed to create employee.";

        if (
          Array.isArray(
            employeeData.detail
          )
        ) {

          errorMessage =
            employeeData.detail
              .map(
                (error: any) =>
                  error.msg
              )
              .join(", ");

        } else if (
          employeeData.detail
        ) {

          errorMessage =
            employeeData.detail;
        }

        throw new Error(
          errorMessage
        );
      }

      // =========================
      // DELETE RECRUITMENT
      // =========================

      const deleteRecruitmentResponse =
        await fetch(
          `${API}/recruitment/${item.recruitment_id}`,
          {
            method: "DELETE",
          }
        );

      if (
        !deleteRecruitmentResponse.ok
      ) {

        let errorMessage =
          "Employee was created, but the recruitment record could not be deleted.";

        try {

          const deleteData =
            await deleteRecruitmentResponse.json();

          if (
            deleteData.detail
          ) {

            errorMessage =
              deleteData.detail;
          }

        } catch {}

        alert(
          `${capitalizeName(
            item.applicant_name
          )} has been added as an employee.\n\n` +
          `However, the recruitment record could not be deleted.\n` +
          `You can delete that recruitment record manually.`
        );

        console.error(
          "Recruitment deletion error:",
          errorMessage
        );

        await fetchData();

        return;
      }

      alert(
        `${capitalizeName(
          item.applicant_name
        )} has been added as an employee!\n\n` +
        `User ID: Not assigned yet\n` +
        `The Superadmin will assign the User ID later.\n\n` +
        `The recruitment record has been removed.`
      );

      await fetchData();

    } catch (error: any) {

      console.error(
        "Create employee error:",
        error
      );

      alert(
        error.message ||
          "Something went wrong."
      );
    }
  };

  // =========================
  // STATUS CLASS
  // =========================

  const getStatusClass = (
    status: string
  ) => {

    switch (status) {

      case "Pending":
        return "status-pending";

      case "For Interview":
        return "status-interview";

      case "Interviewed":
        return "status-interviewed";

      case "Shortlisted":
        return "status-shortlisted";

      case "Hired":
        return "status-hired";

      case "Rejected":
        return "status-rejected";

      default:
        return "status-pending";
    }
  };

  return (
    <div className="hris-layout">

      <HRISSidebar />

      <main className="main-content">

        {/* PAGE HEADER */}

        <div className="page-header">

          <div>

            <h1>
              Recruitment
            </h1>

            <p>
              Manage applicants and the
              recruitment process
            </p>

          </div>

          <div className="current-date">
            {currentDate}
          </div>

        </div>

        {/* STATS */}

        <div className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon">
              📋
            </div>

            <div>

              <span>
                Total Recruitment
              </span>

              <strong>
                {recruitments.length}
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ⏳
            </div>

            <div>

              <span>
                Pending
              </span>

              <strong>
                {pendingCount}
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              📅
            </div>

            <div>

              <span>
                For Interview
              </span>

              <strong>
                {interviewCount}
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ✓
            </div>

            <div>

              <span>
                Hired
              </span>

              <strong>
                {hiredCount}
              </strong>

            </div>

          </div>

        </div>

        {/* RECORDS */}

        <div className="records-card">

          <div className="records-header">

            <div>

              <h2>
                Recruitment Records
              </h2>

              <p>
                View and manage applicant
                recruitment records
              </p>

            </div>

            <button
              className="add-button"
              onClick={openAddModal}
            >
              + Add Applicant
            </button>

          </div>

          {/* FILTERS */}

          <div className="filters">

            <div className="search-box">

              <span>
                🔍
              </span>

              <input
                type="text"
                placeholder="Search applicant..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="">
                All Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="For Interview">
                For Interview
              </option>

              <option value="Interviewed">
                Interviewed
              </option>

              <option value="Shortlisted">
                Shortlisted
              </option>

              <option value="Hired">
                Hired
              </option>

              <option value="Rejected">
                Rejected
              </option>

            </select>

            <select
              value={positionFilter}
              onChange={(e) =>
                setPositionFilter(
                  e.target.value
                )
              }
            >

              <option value="">
                All Positions
              </option>

              {positions.map(
                (position) => (
                  <option
                    key={
                      position.position_id
                    }
                    value={
                      position.position_id
                    }
                  >
                    {
                      position.position_name
                    }
                  </option>
                )
              )}

            </select>

          </div>

          {/* TABLE */}

          <div className="table-wrapper">

            <table>

              <thead>

                <tr>

                  <th>
                    APPLICANT
                  </th>

                  <th>
                    POSITION
                  </th>

                  <th>
                    APPLICATION DATE
                  </th>

                  <th>
                    INTERVIEW DATE
                  </th>

                  <th>
                    RESULT
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
                      colSpan={7}
                      className="empty-cell"
                    >
                      Loading recruitment
                      records...
                    </td>

                  </tr>

                ) : filteredRecruitments.length === 0 ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="empty-cell"
                    >
                      No recruitment
                      records found.
                    </td>

                  </tr>

                ) : (

                  filteredRecruitments.map(
                    (item) => {

                      const isEditingProcess =
                        editingProcessId ===
                        item.recruitment_id;

                      const previewStatus =
                        isEditingProcess
                          ? getProcessStatus(
                              interviewDateDraft,
                              resultDraft
                            )
                          : item.recruitment_status;

                      return (

                        <tr
                          key={
                            item.recruitment_id
                          }
                        >

                          {/* APPLICANT */}

                          <td>

                            <div className="applicant-cell">

                              <div className="applicant-avatar">

                                {capitalizeName(
                                  item.applicant_name
                                ).charAt(0)}

                              </div>

                              <div>

                                <strong>
                                  {capitalizeName(
                                    item.applicant_name
                                  )}
                                </strong>

                                <span>
                                  {
                                    item.email
                                  }
                                </span>

                              </div>

                            </div>

                          </td>

                          {/* POSITION */}

                          <td>
                            {
                              item.position_name
                            }
                          </td>

                          {/* APPLICATION DATE */}

                          <td>

                            {item.application_date
                              ? new Date(
                                  item.application_date
                                ).toLocaleDateString()
                              : "-"}

                          </td>

                          {/* INTERVIEW DATE */}

                          <td>

                            {isEditingProcess ? (

                              <input
                                type="date"
                                value={
                                  interviewDateDraft
                                }
                                onChange={(e) =>
                                  setInterviewDateDraft(
                                    e.target.value
                                  )
                                }
                                style={{
                                  width: "150px",
                                  padding: "6px 8px",
                                  border:
                                    "1px solid #cbd5e1",
                                  borderRadius:
                                    "6px",
                                  background:
                                    "#ffffff",
                                }}
                              />

                            ) : (

                              <span
                                onClick={() =>
                                  startProcessEdit(
                                    item
                                  )
                                }
                                style={{
                                  cursor:
                                    "pointer",
                                }}
                                title="Click to schedule interview"
                              >

                                {item.interview_date
                                  ? new Date(
                                      item.interview_date
                                    ).toLocaleDateString()
                                  : "Set Interview Date"}

                              </span>

                            )}

                          </td>

                          {/* RESULT */}

                          <td>

                            {isEditingProcess ? (

                              <select
                                value={
                                  resultDraft
                                }
                                onChange={(e) =>
                                  setResultDraft(
                                    e.target.value
                                  )
                                }
                                style={{
                                  width: "120px",
                                  padding: "6px 8px",
                                  border:
                                    "1px solid #cbd5e1",
                                  borderRadius:
                                    "6px",
                                  background:
                                    "#ffffff",
                                }}
                              >

                                <option value="Pending">
                                  Pending
                                </option>

                                <option value="Passed">
                                  Passed
                                </option>

                                <option value="Failed">
                                  Failed
                                </option>

                              </select>

                            ) : (

                              <span
                                onClick={() =>
                                  startProcessEdit(
                                    item
                                  )
                                }
                                style={{
                                  cursor:
                                    "pointer",
                                }}
                                title="Click to update result"
                              >

                                {item.result ||
                                  "Pending"}

                              </span>

                            )}

                          </td>

                          {/* STATUS */}

                          <td>

                            <span
                              className={`status-badge ${getStatusClass(
                                previewStatus
                              )}`}
                            >
                              {
                                previewStatus
                              }
                            </span>

                          </td>

                          {/* ACTIONS */}

                          <td>

                            <div className="actions">

                              {isEditingProcess ? (

                                <>

                                  <button
                                    className="save-button"
                                    onClick={() =>
                                      saveProcessEdit(
                                        item
                                      )
                                    }
                                  >
                                    Save
                                  </button>

                                  <button
                                    className="cancel-button"
                                    onClick={
                                      cancelProcessEdit
                                    }
                                  >
                                    Cancel
                                  </button>

                                </>

                              ) : (

                                <>

                                  {item.recruitment_status ===
                                    "Hired" && (

                                    <button
                                      className="hire-button"
                                      onClick={() =>
                                        createEmployee(
                                          item
                                        )
                                      }
                                    >
                                      Create Employee
                                    </button>

                                  )}

                                  <button
                                    className="edit-button"
                                    onClick={() =>
                                      openEditModal(
                                        item
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    className="delete-button"
                                    onClick={() =>
                                      deleteRecruitment(
                                        item.recruitment_id
                                      )
                                    }
                                  >
                                    Delete
                                  </button>

                                </>

                              )}

                            </div>

                          </td>

                        </tr>

                      );
                    }
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

      {/* ADD / EDIT MODAL */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowModal(false)
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
                  {editingId
                    ? "Edit Recruitment"
                    : "Add Applicant"}
                </h2>

                <p>
                  {editingId
                    ? "Update the applicant recruitment record."
                    : "Add an applicant and create their recruitment record."}
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowModal(false)
                }
              >
                ×
              </button>

            </div>

            <div className="form-grid">

              {/* FIRST NAME */}

              <div className="form-group">

                <label>
                  FIRST NAME
                </label>

                <input
                  type="text"
                  placeholder="Enter first name"
                  value={
                    form.first_name
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      first_name:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* LAST NAME */}

              <div className="form-group">

                <label>
                  LAST NAME
                </label>

                <input
                  type="text"
                  placeholder="Enter last name"
                  value={
                    form.last_name
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      last_name:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* BIRTH DATE */}

              <div className="form-group">

                <label>
                  BIRTH DATE
                </label>

                <input
                  type="date"
                  value={
                    form.birth_date
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      birth_date:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* EMAIL */}

              <div className="form-group">

                <label>
                  EMAIL
                </label>

                <input
                  type="email"
                  placeholder="Enter email"
                  value={
                    form.email
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* CONTACT NUMBER */}

              <div className="form-group">

                <label>
                  CONTACT NUMBER
                </label>

                <input
                  type="text"
                  placeholder="Enter contact number"
                  value={
                    form.contact_no
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contact_no:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* ADDRESS */}

              <div className="form-group">

                <label>
                  ADDRESS
                </label>

                <input
                  type="text"
                  placeholder="Enter complete address"
                  value={
                    form.address
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* APPLICATION DATE */}

              <div className="form-group">

                <label>
                  APPLICATION DATE
                </label>

                <input
                  type="date"
                  value={
                    form.application_date
                  }
                  disabled
                />

              </div>

              {/* POSITION */}

              <div className="form-group">

                <label>
                  POSITION
                </label>

                <input
                  type="text"
                  value="Employee"
                  disabled
                />

              </div>

              {/* INTERVIEW DATE */}

              <div className="form-group">

                <label>
                  INTERVIEW DATE
                </label>

                <input
                  type="date"
                  value={
                    form.interview_date
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      interview_date:
                        e.target.value,
                    })
                  }
                />

              </div>

              {/* RESULT */}

              <div className="form-group">

                <label>
                  RESULT
                </label>

                <select
                  value={
                    form.result
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      result:
                        e.target.value,
                    })
                  }
                >

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Passed">
                    Passed
                  </option>

                  <option value="Failed">
                    Failed
                  </option>

                </select>

              </div>

              {/* RECRUITMENT STATUS */}

              <div className="form-group">

                <label>
                  RECRUITMENT STATUS
                </label>

                <input
                  type="text"
                  value={
                    getAutomaticStatus()
                  }
                  disabled
                />

              </div>

            </div>

            <div className="modal-actions">

              <button
                className="cancel-button"
                onClick={() =>
                  setShowModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="save-button"
                onClick={
                  saveApplicantAndRecruitment
                }
              >
                {editingId
                  ? "Update Recruitment"
                  : "Add Applicant"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}