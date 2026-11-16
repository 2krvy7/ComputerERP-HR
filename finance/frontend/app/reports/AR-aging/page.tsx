import "./ar-aging.css";

export default function ARAgingPage() {
  return (
    <div className="ar-aging-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AR Aging</h1>
          <p>
            Understand overdue customer balances and focus your
            collection efforts where they matter.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary">Export</button>
          <button className="btn btn-primary">Print Report</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <button>As of Oct 31, 2026</button>
        <button>Age by due date</button>
        <button>All customers</button>
        <button>USD</button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Total Receivables</span>
          <h2>$48,250.00</h2>
          <small>24 invoices • 7 customers</small>
        </div>

        <div className="summary-card">
          <span>Current</span>
          <h2>$39,750.00</h2>
          <small>82.4% of outstanding receivables</small>
        </div>

        <div className="summary-card">
          <span>Overdue</span>
          <h2>$8,500.00</h2>
          <small>17.6% of outstanding receivables</small>
        </div>

        <div className="summary-card">
          <span>Over 60 Days</span>
          <h2>$2,200.00</h2>
          <small>Harbor Studio & Nova Ventures</small>
        </div>
      </div>

      {/* Balance by Age */}
      <div className="aging-section">
        <div className="section-header">
          <h3>Balance by Age</h3>
          <span>As of October 31, 2026</span>
        </div>

        <div className="aging-bar">
          <div className="current"></div>
          <div className="days30"></div>
          <div className="days60"></div>
          <div className="days90"></div>
          <div className="days120"></div>
        </div>

        <div className="aging-legend">
          <div>
            <span className="dot blue"></span>
            Current
            <strong>$39,750.00</strong>
          </div>

          <div>
            <span className="dot light-blue"></span>
            1-30 Days
            <strong>$4,300.00</strong>
          </div>

          <div>
            <span className="dot sky"></span>
            31-60 Days
            <strong>$2,000.00</strong>
          </div>

          <div>
            <span className="dot orange"></span>
            61-90 Days
            <strong>$1,200.00</strong>
          </div>

          <div>
            <span className="dot red"></span>
            90+ Days
            <strong>$1,000.00</strong>
          </div>
        </div>
      </div>

      {/* Receivables Table */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h3>Acme Studio · Receivables Aging</h3>
            <p>
              Outstanding customer balances at October 31, 2026
            </p>
          </div>

          <button className="btn btn-secondary">
            View Invoices
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Current</th>
              <th>1-30 Days</th>
              <th>31-60 Days</th>
              <th>61-90 Days</th>
              <th>90+ Days</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Northstar Co.</td>
              <td>$6,250.00</td>
              <td>$2,500.00</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$8,750.00</td>
            </tr>

            <tr>
              <td>Linear Labs</td>
              <td>$8,400.00</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$8,400.00</td>
            </tr>

            <tr>
              <td>Meridian</td>
              <td>$12,000.00</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$12,000.00</td>
            </tr>

            <tr>
              <td>Atlas Digital</td>
              <td>$7,100.00</td>
              <td>-</td>
              <td>$2,000.00</td>
              <td>-</td>
              <td>-</td>
              <td>$9,100.00</td>
            </tr>

            <tr>
              <td>Bloom Collective</td>
              <td>$6,000.00</td>
              <td>$1,800.00</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$7,800.00</td>
            </tr>

            <tr>
              <td>Harbor Studio</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$1,200.00</td>
              <td>-</td>
              <td>$1,200.00</td>
            </tr>

            <tr>
              <td>Nova Ventures</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$1,000.00</td>
              <td>$1,000.00</td>
            </tr>

            <tr className="total-row">
              <td>Total Receivables</td>
              <td>$39,750.00</td>
              <td>$4,300.00</td>
              <td>$2,000.00</td>
              <td>$1,200.00</td>
              <td>$1,000.00</td>
              <td>$48,250.00</td>
            </tr>
          </tbody>
        </table>

        <div className="table-footer">
          <p>
            7 customers · 24 unpaid invoices · Total agrees with
            the Accounts Receivable balance in the ledger
          </p>
        </div>
      </div>

      {/* Insights */}
      <div className="notes-section">
        <p>
          Recover the oldest balances. Nova Ventures owes
          $1,000 over 90 days and Harbor Studio owes
          $1,200 at 61-90 days.
        </p>

        <p>
          Payment promises: $4,500. Atlas Digital promised
          $2,000 on November 3. Northstar Co. promised the
          remaining $2,500 on November 5.
        </p>
      </div>
    </div>
  );
}