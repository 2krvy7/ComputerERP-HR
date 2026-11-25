"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/EmployeeSidebar";
import "./employee-profile.css";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Temporary employee ID for testing
const CURRENT_EMPLOYEE_ID = 2;

type Employee = {
  employee_id: number;
  userid: string;
  position_id: number | null;
  first_name: string;
  last_name: string;
  birth_date: string;
  contact_no: string;
  email: string;
  address: string;
  hire_date: string;
  employment_status: string;
};

type Position = {
  position_id: number;
  position_name: string;
};

export default function EmployeeProfile() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get employees
        const employeeResponse = await fetch(`${API}/employees/`);

        if (!employeeResponse.ok) {
          throw new Error("Failed to fetch employees");
        }

        const employees = await employeeResponse.json();

        const currentEmployee = employees.find(
          (emp: Employee) =>
            emp.employee_id === CURRENT_EMPLOYEE_ID
        );

        setEmployee(currentEmployee || null);

        // Get positions
        const positionResponse = await fetch(`${API}/positions/`);

        if (positionResponse.ok && currentEmployee?.position_id) {
          const positions = await positionResponse.json();

          const currentPosition = positions.find(
            (pos: Position) =>
              pos.position_id === currentEmployee.position_id
          );

          setPosition(currentPosition || null);
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const formatDate = (date: string) => {
    if (!date) return "Not provided";

    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  /*
   * Loading
   */
  if (loading) {
    return (
      <div className="employee-layout">
        <EmployeeSidebar
          username="Employee"
          userId={`EMP-${String(CURRENT_EMPLOYEE_ID).padStart(3, "0")}`}
          role="Employee"
        />

        <main className="employee-main">
          <div className="loading">
            Loading profile...
          </div>
        </main>
      </div>
    );
  }

  /*
   * Employee not found
   */
  if (!employee) {
    return (
      <div className="employee-layout">
        <EmployeeSidebar
          username="Employee"
          userId={`EMP-${String(CURRENT_EMPLOYEE_ID).padStart(3, "0")}`}
          role="Employee"
        />

        <main className="employee-main">
          <div className="empty-profile">
            <h2>Employee Not Found</h2>

            <p>
              No employee record was found for the current employee ID.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="employee-layout">

      {/* SHARED EMPLOYEE SIDEBAR */}
      <EmployeeSidebar
        username={`${employee.first_name} ${employee.last_name}`}
        userId={`EMP-${String(employee.employee_id).padStart(3, "0")}`}
        role="Employee"
      />

      {/* MAIN CONTENT */}
      <main className="employee-main">

        <header className="employee-header">
          <div>
            <h1>My Profile</h1>

            <p>
              View your personal and employment information
            </p>
          </div>

          <div className="current-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </header>

        {/* PROFILE HEADER */}
        <section className="profile-card">

          <div className="profile-avatar">
            {employee.first_name.charAt(0)}
            {employee.last_name.charAt(0)}
          </div>

          <div className="profile-name">

            <h2>
              {employee.first_name} {employee.last_name}
            </h2>

            <p>
              Employee ID: {employee.employee_id}
            </p>

            <p>
              {position?.position_name || "Position not assigned"}
            </p>

            <span
              className={`status-badge ${
                employee.employment_status?.toLowerCase() === "active"
                  ? "active"
                  : employee.employment_status?.toLowerCase() === "on leave"
                  ? "leave"
                  : "inactive"
              }`}
            >
              {employee.employment_status}
            </span>

          </div>

        </section>

        {/* PERSONAL INFORMATION */}
        <section className="info-card">

          <div className="section-title">
            <h2>Personal Information</h2>

            <p>
              Your basic personal information
            </p>
          </div>

          <div className="info-grid">

            <div className="info-item">
              <label>First Name</label>

              <div>
                {employee.first_name || "Not provided"}
              </div>
            </div>

            <div className="info-item">
              <label>Last Name</label>

              <div>
                {employee.last_name || "Not provided"}
              </div>
            </div>

            <div className="info-item">
              <label>Birth Date</label>

              <div>
                {formatDate(employee.birth_date)}
              </div>
            </div>

            <div className="info-item">
              <label>Contact Number</label>

              <div>
                {employee.contact_no || "Not provided"}
              </div>
            </div>

            <div className="info-item">
              <label>Email</label>

              <div>
                {employee.email || "Not provided"}
              </div>
            </div>

            <div className="info-item full-width">
              <label>Address</label>

              <div>
                {employee.address || "Not provided"}
              </div>
            </div>

          </div>

        </section>

        {/* EMPLOYMENT INFORMATION */}
        <section className="info-card">

          <div className="section-title">
            <h2>Employment Information</h2>

            <p>
              Your employment details
            </p>
          </div>

          <div className="info-grid">

            <div className="info-item">
              <label>Employee ID</label>

              <div>
                {employee.employee_id}
              </div>
            </div>

            <div className="info-item">
              <label>User ID</label>

              <div>
                {employee.userid}
              </div>
            </div>

            <div className="info-item">
              <label>Position</label>

              <div>
                {position?.position_name || "Position not assigned"}
              </div>
            </div>

            <div className="info-item">
              <label>Hire Date</label>

              <div>
                {formatDate(employee.hire_date)}
              </div>
            </div>

            <div className="info-item">
              <label>Employment Status</label>

              <div>
                {employee.employment_status}
              </div>
            </div>

          </div>

        </section>

        {/* INFORMATION NOTE */}
        <div className="profile-note">

          <span>ℹ️</span>

          <div>
            <strong>Profile Information</strong>

            <p>
              Your profile information is managed by the HR department.
              If you need to update any information, please contact HR.
            </p>
          </div>

        </div>

      </main>
    </div>
  );
}