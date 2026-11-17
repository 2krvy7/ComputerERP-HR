import React from "react";
import "./income-statement.css";

export default function IncomeStatement() {
  return (
    <div className="income-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Income Statement</h1>
          <p>
            Understand what you earned, what you spent and the profit left over.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light">Export</button>
          <button className="btn-primary">Print Report</button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="tabs">
        <button className="active">This month</button>
        <button>This quarter</button>
        <button>This year</button>
        <button>Custom</button>
      </div>

      {/* Filters */}
      <div className="filters">
        <button className="btn-light">Oct 1 - 31, 2026</button>
        <button className="btn-light">Compare: Previous month</button>
        <button className="btn-light">Accrual basis</button>

        <button className="btn-light push-right">
          Update report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Revenue</p>
          <h2>$86,420.00</h2>
          <span className="positive">
            +8.2% vs September
          </span>
        </div>

        <div className="summary-card">
          <p>Total costs & expenses</p>
          <h2>$52,180.00</h2>
          <span className="negative">
            -3.3% vs September
          </span>
        </div>

        <div className="summary-card">
          <p>Net income</p>
          <h2>$34,240.00</h2>
          <span className="positive">
            +32.1% vs September
          </span>
        </div>

        <div className="summary-card">
          <p>Net profit margin</p>
          <h2>39.6%</h2>
          <span className="positive">
            +7.2 percentage points
          </span>
        </div>
      </div>

      {/* Statement Table */}
      <div className="table-card">
        <div className="table-header">
          <h3>Acme Studio - Income Statement</h3>

          <p>
            For the month ended October 31, 2026 • Compared
            with September 2026 • USD
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Code</th>
              <th>Oct 2026</th>
              <th>Sep 2026</th>
              <th>Change</th>
            </tr>
          </thead>

          <tbody>

            {/* Revenue */}
            <tr className="section-row">
              <td colSpan={5}>Revenue</td>
            </tr>

            <tr>
              <td>Design Services</td>
              <td>4000</td>
              <td>$74,200.00</td>
              <td>$69,000.00</td>
              <td className="positive">+$5,200.00</td>
            </tr>

            <tr>
              <td>Subscription Revenue</td>
              <td>4100</td>
              <td>$12,220.00</td>
              <td>$11,870.00</td>
              <td className="positive">+$350.00</td>
            </tr>

            <tr className="total-row">
              <td>Total Revenue</td>
              <td></td>
              <td>$86,420.00</td>
              <td>$79,870.00</td>
              <td>+$6,550.00</td>
            </tr>

            {/* COS */}
            <tr className="section-row">
              <td colSpan={5}>Cost of Sales</td>
            </tr>

            <tr>
              <td>Cost of Services</td>
              <td>5000</td>
              <td>$24,500.00</td>
              <td>$25,000.00</td>
              <td>-$500.00</td>
            </tr>

            <tr className="gross-profit-row">
              <td>Gross Profit</td>
              <td></td>
              <td>$61,920.00</td>
              <td>$54,870.00</td>
              <td>+$7,050.00</td>
            </tr>

            {/* Expenses */}
            <tr className="section-row">
              <td colSpan={5}>Operating Expenses</td>
            </tr>

            <tr>
              <td>Salaries & Wages</td>
              <td>6000</td>
              <td>$18,500.00</td>
              <td>$19,000.00</td>
              <td>-$500.00</td>
            </tr>

            <tr>
              <td>Software & Subscriptions</td>
              <td>6100</td>
              <td>$2,480.00</td>
              <td>$2,650.00</td>
              <td>-$170.00</td>
            </tr>

            <tr>
              <td>Rent & Facilities</td>
              <td>6200</td>
              <td>$5,000.00</td>
              <td>$5,000.00</td>
              <td>$0.00</td>
            </tr>

            <tr>
              <td>Marketing</td>
              <td>6300</td>
              <td>$1,200.00</td>
              <td>$1,800.00</td>
              <td>-$600.00</td>
            </tr>

            <tr>
              <td>Depreciation Expense</td>
              <td>6400</td>
              <td>$500.00</td>
              <td>$500.00</td>
              <td>$0.00</td>
            </tr>

            <tr className="total-row">
              <td>Total Operating Expenses</td>
              <td></td>
              <td>$27,680.00</td>
              <td>$28,950.00</td>
              <td>-$1,270.00</td>
            </tr>

            <tr className="total-row">
              <td>Total Costs & Expenses</td>
              <td></td>
              <td>$52,180.00</td>
              <td>$53,950.00</td>
              <td>-$1,770.00</td>
            </tr>

            <tr className="net-income-row">
              <td>Net Income</td>
              <td></td>
              <td>$34,240.00</td>
              <td>$25,920.00</td>
              <td>+$8,320.00</td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* Analysis */}
      <div className="analysis-card">
        <p>
          Revenue grew while costs eased. Revenue increased
          $6,550 and total costs decreased $1,770.
          Together they lifted net income by $8,320 over
          September.
        </p>

        <p>
          Gross margin: 71.7%. Design services generated
          85.9% of revenue. Cost of services was
          $24,500 leaving $61,920 in gross profit.
        </p>
      </div>
    </div>
  );
}
