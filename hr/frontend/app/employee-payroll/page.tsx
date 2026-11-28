"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/EmployeeSidebar";
import { getUser } from "../../components/AuthGate";
import "./employee-payroll.css";

const API = process.env.NEXT_PUBLIC_API_URL!;

type Employee = {
  employee_id: number;
  userid: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  contact_no: string;
  address: string;
  hire_date: string;
  employment_status: string;
};

type Payroll = {
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  pay_period: string;
  overtime: number;
  gross_salary: number;
  sss: number;
  philhealth: number;
  pag_ibig: number;
  deductions: number;
  net_salary: number;
  "13th_month_pay": number;
  payroll_status: string;
  payment_date: string | null;
};

export default function EmployeePayrollPage() {
  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [payroll, setPayroll] =
    useState<Payroll[]>([]);

  const [loading, setLoading] = useState(true);

  // Current date is set after the component mounts
  // to prevent the Next.js prerender error.
  const [currentDate, setCurrentDate] =
    useState("");

  useEffect(() => {
    const updateCurrentDate = () => {
      const now = new Date();

      const displayDate = new Intl.DateTimeFormat(
        "en-PH",
        {
          timeZone: "Asia/Manila",
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }
      ).format(now);

      setCurrentDate(displayDate);
    };

    updateCurrentDate();
    fetchEmployeeAndPayroll();
  }, []);

  // ==========================
  // FETCH CURRENT EMPLOYEE
  // ==========================

  const fetchEmployeeAndPayroll = async () => {
    try {
      // Get logged-in user from JWT
      const loggedInUser = getUser();

      if (!loggedInUser) {
        console.error(
          "No logged-in user found."
        );
        setLoading(false);
        return;
      }

      const loggedInUserId = String(
        loggedInUser.sub
      );

      // ==========================
      // GET EMPLOYEES
      // ==========================

      const employeeResponse = await fetch(
        `${API}/employees/`
      );

      if (!employeeResponse.ok) {
        throw new Error(
          "Failed to fetch employees"
        );
      }

      const employees: Employee[] =
        await employeeResponse.json();

      // Find the employee connected to
      // the logged-in user's UserID
      const currentEmployee =
        employees.find(
          (emp) =>
            String(emp.userid ?? "") ===
            loggedInUserId
        );

      if (!currentEmployee) {
        console.error(
          "No employee record found for the logged-in user."
        );

        setEmployee(null);
        setPayroll([]);
        setLoading(false);
        return;
      }

      setEmployee(currentEmployee);

      const currentEmployeeId =
        Number(currentEmployee.employee_id);

      // ==========================
      // GET PAYROLL
      // ==========================

      const payrollResponse = await fetch(
        `${API}/payroll/`
      );

      if (!payrollResponse.ok) {
        throw new Error(
          "Failed to fetch payroll records"
        );
      }

      const data: Payroll[] =
        await payrollResponse.json();

      // Only show payroll belonging to
      // the logged-in employee
      const myPayroll = data.filter(
        (record) =>
          Number(record.employee_id) ===
          currentEmployeeId
      );

      setPayroll(myPayroll);
    } catch (error) {
      console.error(
        "Error fetching payroll:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // FORMAT CURRENCY
  // ==========================

  const formatCurrency = (
    amount: number | null | undefined
  ) => {
    return `₱${Number(
      amount || 0
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ==========================
  // FORMAT DATE
  // ==========================

  /*
   * Safely formats YYYY-MM-DD dates.
   * This avoids timezone issues and Invalid Date.
   */
  const formatDate = (
    date: string | null
  ) => {
    if (!date) {
      return "--";
    }

    const dateOnly =
      String(date).substring(0, 10);

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
          "en-US",
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

  // ==========================
  // STATUS CLASS
  // ==========================

  const getStatusClass = (
    status: string
  ) => {
    switch (
      status?.toLowerCase()
    ) {
      case "paid":
        return "status-paid";

      case "processed":
        return "status-processed";

      case "pending":
        return "status-pending";

      default:
        return "status-default";
    }
  };

  // ==========================
  // SORT PAYROLL
  // ==========================

  // Sort newest payroll first.
  const sortedPayroll = [
    ...payroll,
  ].sort(
    (a, b) =>
      b.payroll_id - a.payroll_id
  );

  const latestPayroll =
    sortedPayroll[0];

  // ==========================
  // PAYROLL TOTALS
  // ==========================

  const totalNetSalary =
    payroll.reduce(
      (total, record) =>
        total +
        Number(
          record.net_salary || 0
        ),
      0
    );

  const totalGrossSalary =
    payroll.reduce(
      (total, record) =>
        total +
        Number(
          record.gross_salary || 0
        ),
      0
    );

  const totalDeductions =
    payroll.reduce(
      (total, record) =>
        total +
        Number(record.sss || 0) +
        Number(
          record.philhealth || 0
        ) +
        Number(
          record.pag_ibig || 0
        ) +
        Number(
          record.deductions || 0
        ),
      0
    );

  // ==========================
  // LOADING
  // ==========================

  if (loading) {
    return (
      <div className="employee-page">

        <EmployeeSidebar
          username="Employee"
          userId="Employee"
          role="Employee"
        />

        <main className="employee-main">

          <div className="payroll-empty">

            <div className="loading-spinner"></div>

            <p>
              Loading payroll records...
            </p>

          </div>

        </main>

      </div>
    );
  }

  // ==========================
  // EMPLOYEE NOT FOUND
  // ==========================

  if (!employee) {
    return (
      <div className="employee-page">

        <EmployeeSidebar
          username="Employee"
          userId="Employee"
          role="Employee"
        />

        <main className="employee-main">

          <div className="payroll-empty">

            <div className="empty-icon">
              👤
            </div>

            <h3>
              Employee Not Found
            </h3>

            <p>
              No employee record was found
              for the logged-in user.
            </p>

          </div>

        </main>

      </div>
    );
  }

  return (
    <div className="employee-page">

      {/* ==========================
          SHARED EMPLOYEE SIDEBAR
      ========================== */}

      <EmployeeSidebar
        username={`${employee.first_name} ${employee.last_name}`}
        userId={`EMP-${String(
          employee.employee_id
        ).padStart(3, "0")}`}
        role="Employee"
      />

      {/* ==========================
          MAIN CONTENT
      ========================== */}

      <main className="employee-main">

        {/* ==========================
            HEADER
        ========================== */}

        <header className="employee-header">

          <div>

            <h1>
              My Payroll
            </h1>

            <p>
              View your salary and payroll
              history.
            </p>

          </div>

          <div className="employee-date">
            {currentDate}
          </div>

        </header>

        {/* ==========================
            SUMMARY CARDS
        ========================== */}

        <section className="payroll-stats">

          <div className="payroll-stat-card">

            <div className="stat-icon">
              📋
            </div>

            <div>

              <span>
                Payroll Records
              </span>

              <strong>
                {payroll.length}
              </strong>

            </div>

          </div>

          <div className="payroll-stat-card">

            <div className="stat-icon">
              💵
            </div>

            <div>

              <span>
                Latest Net Salary
              </span>

              <strong className="salary-value">
                {latestPayroll
                  ? formatCurrency(
                      latestPayroll.net_salary
                    )
                  : "₱0.00"}
              </strong>

            </div>

          </div>

          <div className="payroll-stat-card">

            <div className="stat-icon">
              📈
            </div>

            <div>

              <span>
                Total Gross
              </span>

              <strong className="salary-value">
                {formatCurrency(
                  totalGrossSalary
                )}
              </strong>

            </div>

          </div>

          <div className="payroll-stat-card">

            <div className="stat-icon">
              −
            </div>

            <div>

              <span>
                Total Deductions
              </span>

              <strong className="salary-value">
                {formatCurrency(
                  totalDeductions
                )}
              </strong>

            </div>

          </div>

        </section>

        {/* ==========================
            LATEST PAYROLL
        ========================== */}

        {latestPayroll && (
          <section className="latest-payroll-card">

            <div className="latest-header">

              <div>

                <h2>
                  Latest Payroll
                </h2>

                <p>
                  {latestPayroll.pay_period}
                </p>

              </div>

              <span
                className={`payroll-status ${getStatusClass(
                  latestPayroll.payroll_status
                )}`}
              >
                {
                  latestPayroll.payroll_status
                }
              </span>

            </div>

            <div className="salary-highlight">

              <div>

                <span>
                  Net Salary
                </span>

                <strong>
                  {formatCurrency(
                    latestPayroll.net_salary
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Gross Salary
                </span>

                <strong>
                  {formatCurrency(
                    latestPayroll.gross_salary
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Payment Date
                </span>

                <strong>
                  {formatDate(
                    latestPayroll.payment_date
                  )}
                </strong>

              </div>

            </div>

          </section>
        )}

        {/* ==========================
            PAYROLL HISTORY
        ========================== */}

        <section className="payroll-record-card">

          <div className="record-header">

            <div>

              <h2>
                Payroll History
              </h2>

              <p>
                Your semi-monthly payroll
                records
              </p>

            </div>

          </div>

          {payroll.length === 0 ? (

            <div className="payroll-empty">

              <div className="empty-icon">
                💰
              </div>

              <h3>
                No Payroll Records
              </h3>

              <p>
                You don't have any payroll
                records yet.
              </p>

            </div>

          ) : (

            <div className="payroll-table-wrapper">

              <table className="payroll-table">

                <thead>

                  <tr>

                    <th>
                      PAY PERIOD
                    </th>

                    <th>
                      OVERTIME
                    </th>

                    <th>
                      GROSS SALARY
                    </th>

                    <th>
                      SSS
                    </th>

                    <th>
                      PHILHEALTH
                    </th>

                    <th>
                      PAG-IBIG
                    </th>

                    <th>
                      DEDUCTIONS
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

                  {sortedPayroll.map(
                    (record) => (

                      <tr
                        key={
                          record.payroll_id
                        }
                      >

                        <td>

                          <div className="pay-period-cell">

                            <div className="pay-period-icon">
                              💰
                            </div>

                            <strong>
                              {
                                record.pay_period
                              }
                            </strong>

                          </div>

                        </td>

                        <td>
                          {formatCurrency(
                            record.overtime
                          )}
                        </td>

                        <td className="gross-cell">
                          {formatCurrency(
                            record.gross_salary
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.sss
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.philhealth
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.pag_ibig
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.deductions
                          )}
                        </td>

                        <td className="net-cell">
                          {formatCurrency(
                            record.net_salary
                          )}
                        </td>

                        <td>

                          <span
                            className={`payroll-status ${getStatusClass(
                              record.payroll_status
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

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* ==========================
            PAYROLL INFORMATION
        ========================== */}

        <section className="payroll-info-card">

          <div className="info-icon">
            ℹ
          </div>

          <div>

            <h3>
              About Your Payroll
            </h3>

            <p>
              Your salary is processed
              semi-monthly. Your payroll
              includes overtime, attendance
              deductions, government
              contributions, and other
              applicable deductions.
            </p>

          </div>

        </section>

      </main>

    </div>
  );
}
