import Image from "next/image";
import "./globals.css";

export default function Home() {
  return (

    
    <div className="dashboard">
      <h1 className="page-title">Finance Dashboard</h1>

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="summary-card">
          <h3>Total Assets</h3>
          <p>$1,250,000</p>
        </div>

        <div className="summary-card">
          <h3>Total Liabilities</h3>
          <p>$450,000</p>
        </div>

        <div className="summary-card">
          <h3>Cash Balance</h3>
          <p>$150,000</p>
        </div>

        <div className="summary-card">
          <h3>Net Income</h3>
          <p>$85,000</p>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Revenue vs Expenses</h2>
          <div className="chart-placeholder">
            Chart goes here
          </div>
        </div>

        <div className="panel">
          <h2>Cash Flow</h2>
          <div className="chart-placeholder">
            Chart goes here
          </div>
        </div>
      </div>

      {/* Journal Entries */}
      <div className="panel">
        <h2>Recent Journal Entries</h2>

        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>2026-11-12</td>
              <td>JE-001</td>
              <td>Office Supplies</td>
              <td>$500</td>
            </tr>

            <tr>
              <td>2026-11-11</td>
              <td>JE-002</td>
              <td>Sales Revenue</td>
              <td>$8,500</td>
            </tr>

            <tr>
              <td>2026-11-10</td>
              <td>JE-003</td>
              <td>Utility Expense</td>
              <td>$1,200</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AP/AR */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Accounts Payable</h2>

          <ul>
            <li>Outstanding Invoices: 15</li>
            <li>Total Due: $35,000</li>
            <li>Due This Week: $8,500</li>
          </ul>
        </div>

        <div className="panel">
          <h2>Accounts Receivable</h2>

          <ul>
            <li>Outstanding Invoices: 22</li>
            <li>Total Receivable: $58,000</li>
            <li>Past Due: $6,000</li>
          </ul>
        </div>
      </div>
    </div>
  );
  }
