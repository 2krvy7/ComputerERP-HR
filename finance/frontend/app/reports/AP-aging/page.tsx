import "./ap-aging.css";

export default function APAgingPage() {
  return (
    <div className="ap-aging-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AP Aging</h1>
          <p>
            Know what you owe and prioritize supplier payments by how long
            they're overdue.
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
        <button>All suppliers</button>
        <button>USD</button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Total Payables</span>
          <h2>$32,840.00</h2>
          <small>18 bills • 8 suppliers</small>
        </div>

        <div className="summary-card">
          <span>Current</span>
          <h2>$27,600.00</h2>
          <small>84% of outstanding payables</small>
        </div>

        <div className="summary-card">
          <span>Overdue</span>
          <h2>$5,240.00</h2>
          <small>16% of outstanding payables</small>
        </div>

        <div className="summary-card">
          <span>Over 60 Days</span>
          <h2>$1,300.00</h2>
          <small>Paper & Co and Vertex IT</small>
        </div>
      </div>

      {/* Aging Bar */}
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
            <strong>$27,600</strong>
          </div>

          <div>
            <span className="dot light-blue"></span>
            1-30 Days
            <strong>$2,440</strong>
          </div>

          <div>
            <span className="dot sky"></span>
            31-60 Days
            <strong>$1,500</strong>
          </div>

          <div>
            <span className="dot orange"></span>
            61-90 Days
            <strong>$800</strong>
          </div>

          <div>
            <span className="dot red"></span>
            90+ Days
            <strong>$500</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h3>Acme Studio · Payables Aging</h3>
            <p>
              Outstanding supplier balances at October 31, 2026
            </p>
          </div>

          <button className="btn btn-secondary">
            View Invoices
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Supplier</th>
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
              <td>AWS</td>
              <td>$6,200</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$6,200</td>
            </tr>

            <tr>
              <td>Pixel Supply</td>
              <td>$5,800</td>
              <td>$1,240</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$7,040</td>
            </tr>

            <tr>
              <td>Studio Lease</td>
              <td>$5,000</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$5,000</td>
            </tr>

            <tr>
              <td>Figma</td>
              <td>$3,600</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>$3,600</td>
            </tr>

            <tr>
              <td>Bright Print</td>
              <td>$3,000</td>
              <td>-</td>
              <td>$1,500</td>
              <td>-</td>
              <td>-</td>
              <td>$4,500</td>
            </tr>

            <tr className="total-row">
              <td>Total Payables</td>
              <td>$27,600</td>
              <td>$2,440</td>
              <td>$1,500</td>
              <td>$800</td>
              <td>$500</td>
              <td>$32,840</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}