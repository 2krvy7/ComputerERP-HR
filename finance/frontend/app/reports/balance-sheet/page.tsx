import "./balance-sheet.css";

export default function BalanceSheet() {
  return (
    <div className="balance-sheet-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Balance Sheet</h1>
          <p>
            See what your business owns, what it owes and the equity you've built.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light">Export</button>
          <button className="btn-primary">Print report</button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="tabs">
        <button className="active">This month</button>
        <button>This quarter</button>
        <button>This year</button>
        <button>Custom</button>
      </div>

      <div className="filters">
        <button className="btn-light">
          As of Oct 31, 2026
        </button>

        <button className="btn-light">
          Compare: Sep 30, 2026
        </button>

        <button className="btn-light">
          Accrual basis
        </button>

        <button className="btn-light push-right">
          Update report
        </button>
      </div>

      {/* Summary Cards */}

      <div className="summary-grid">
        <div className="summary-card">
          <p>Total Assets</p>
          <h2>$210,830.00</h2>
          <span className="positive">
            +$35,680 since September
          </span>
        </div>

        <div className="summary-card">
          <p>Total Liabilities</p>
          <h2>$85,840.00</h2>
          <span className="positive">
            +$1,440 since September
          </span>
        </div>

        <div className="summary-card">
          <p>Total Equity</p>
          <h2>$124,990.00</h2>
          <span>
            Includes October net income
          </span>
        </div>

        <div className="summary-card">
          <p>Working Capital</p>
          <h2>$137,990.00</h2>
          <span>
            Current assets less current liabilities
          </span>
        </div>
      </div>

      {/* Two Column Statements */}

      <div className="statement-grid">

        {/* Assets */}
        <div className="statement-card">

          <div className="statement-header">
            <h3>Acme Studio - Assets</h3>
            <p>Financial position · USD · Accrual basis</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Oct 31, 2026</th>
                <th>Sep 30, 2026</th>
              </tr>
            </thead>

            <tbody>

              <tr className="section-row">
                <td colSpan={3}>Current Assets</td>
              </tr>

              <tr>
                <td>Cash & Bank</td>
                <td>$124,580.00</td>
                <td>$93,140.00</td>
              </tr>

              <tr>
                <td>Accounts Receivable</td>
                <td>$48,250.00</td>
                <td>$54,510.00</td>
              </tr>

              <tr>
                <td>Prepaid Expenses</td>
                <td>$6,000.00</td>
                <td>$4,000.00</td>
              </tr>

              <tr className="total-row">
                <td>Total Current Assets</td>
                <td>$178,830.00</td>
                <td>$151,650.00</td>
              </tr>

              <tr className="section-row">
                <td colSpan={3}>Non-Current Assets</td>
              </tr>

              <tr>
                <td>Equipment</td>
                <td>$40,000.00</td>
                <td>$31,000.00</td>
              </tr>

              <tr>
                <td>Accumulated Depreciation</td>
                <td>-$8,000.00</td>
                <td>-$7,500.00</td>
              </tr>

              <tr className="total-row">
                <td>Net Non-Current Assets</td>
                <td>$32,000.00</td>
                <td>$23,500.00</td>
              </tr>

              <tr className="grand-total">
                <td>Total Assets</td>
                <td>$210,830.00</td>
                <td>$175,150.00</td>
              </tr>

            </tbody>
          </table>

        </div>

        {/* Liabilities */}

        <div className="statement-card">

          <div className="statement-header">
            <h3>Liabilities & Equity</h3>
            <p>As of October 31, 2026</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Oct 31, 2026</th>
                <th>Sep 30, 2026</th>
              </tr>
            </thead>

            <tbody>

              <tr className="section-row">
                <td colSpan={3}>Current Liabilities</td>
              </tr>

              <tr>
                <td>Accounts Payable</td>
                <td>$32,840.00</td>
                <td>$37,840.00</td>
              </tr>

              <tr>
                <td>Accrued Expenses</td>
                <td>$8,000.00</td>
                <td>$6,560.00</td>
              </tr>

              <tr className="total-row">
                <td>Total Current Liabilities</td>
                <td>$40,840.00</td>
                <td>$44,400.00</td>
              </tr>

              <tr className="section-row">
                <td colSpan={3}>Non-Current Liabilities</td>
              </tr>

              <tr>
                <td>Business Loan</td>
                <td>$45,000.00</td>
                <td>$40,000.00</td>
              </tr>

              <tr className="total-row">
                <td>Total Liabilities</td>
                <td>$85,840.00</td>
                <td>$84,400.00</td>
              </tr>

              <tr className="section-row">
                <td colSpan={3}>Equity</td>
              </tr>

              <tr>
                <td>Owner Capital</td>
                <td>$80,000.00</td>
                <td>$80,000.00</td>
              </tr>

              <tr>
                <td>Retained Earnings</td>
                <td>$10,750.00</td>
                <td>$10,750.00</td>
              </tr>

              <tr>
                <td>October Net Income</td>
                <td>$34,240.00</td>
                <td>$0.00</td>
              </tr>

              <tr className="grand-total">
                <td>Total Equity</td>
                <td>$124,990.00</td>
                <td>$90,750.00</td>
              </tr>

              <tr className="grand-total">
                <td>Total Liabilities + Equity</td>
                <td>$210,830.00</td>
                <td>$175,150.00</td>
              </tr>

            </tbody>
          </table>

        </div>

      </div>

      {/* Footer Check */}

      <div className="balance-check">
        ✅ Balanced:
        Assets $210,830.00 =
        Liabilities $85,840.00 +
        Equity $124,990.00
      </div>

    </div>
  );
}