import React from "react";
import "./expenses.css";

const expenseData = [
  {
    date: "Oct 30, 2026",
    employee: "Adobe Creative Cloud",
    category: "Software & subscriptions",
    amount: "$240.00",
    receipt: "Receipt.pdf",
    approval: "Pending",
    reimbursement: "Company paid",
  },
  {
    date: "Oct 28, 2026",
    employee: "Printworks",
    category: "Marketing",
    amount: "$720.00",
    receipt: "Invoice.pdf",
    approval: "Pending",
    reimbursement: "Company paid",
  },
  {
    date: "Oct 26, 2026",
    employee: "City Taxi",
    category: "Cost of services",
    amount: "$180.00",
    receipt: "Receipt.jpg",
    approval: "Approved",
    reimbursement: "Pending",
  },
  {
    date: "Oct 24, 2026",
    employee: "Local Workspace",
    category: "Cost of services",
    amount: "$300.00",
    receipt: "Receipt.pdf",
    approval: "Approved",
    reimbursement: "Pending",
  },
  {
    date: "Oct 22, 2026",
    employee: "Dropbox",
    category: "Software & subscriptions",
    amount: "$120.00",
    receipt: "Receipt.pdf",
    approval: "Posted",
    reimbursement: "Company paid",
  },
];
export default function Expenses() {
  return (
    <div className="expenses-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>
            Capture receipts, review team claims and keep business spending
            organized.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light">Export</button>
          <button className="btn-primary">Add expense</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total recorded costs</p>
          <h2>$52,180.00</h2>
          <span>Posted costs, bills and payroll</span>
        </div>

        <div className="summary-card">
          <p>Expense claims</p>
          <h2>$3,360.00</h2>
          <span>28 items submitted this month</span>
        </div>

        <div className="summary-card">
          <p>Awaiting approval</p>
          <h2>$960.00</h2>
          <span>2 claims - Not yet posted</span>
        </div>

        <div className="summary-card">
          <p>To reimburse</p>
          <h2>$480.00</h2>
          <span>2 approved employee claims</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className="active">All expenses</button>
        <button>Pending approval</button>
        <button>To reimburse</button>
        <button>Posted</button>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search expense or employee..."
        />

        <select>
          <option>Oct 1 - 31, 2026</option>
        </select>

        <select>
          <option>All categories</option>
        </select>

        <button className="btn-light">More filters</button>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Expense register</h3>
            <p>
              Receipt attachments are linked to each claim.
            </p>
          </div>

          <button className="btn-light">
            Approve selected
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Expense & Employee</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Approval</th>
              <th>Reimbursement</th>
            </tr>
          </thead>

          <tbody>
            {expenseData.map((item, index) => (
              <tr key={index}>
                <td>{item.date}</td>
                <td>{item.employee}</td>
                <td>{item.category}</td>
                <td>{item.amount}</td>
                <td>
                  <a href="/">{item.receipt}</a>
                </td>
                <td>
                  <span
                    className={`badge ${item.approval.toLowerCase()}`}
                  >
                    {item.approval}
                  </span>
                </td>
                <td>{item.reimbursement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}