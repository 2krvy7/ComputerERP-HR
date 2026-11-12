import "./general-ledger.css";

const ledgerData = [
  {
    date: "Oct 1, 2026",
    description: "Opening Balance",
    reference: "Prior Period",
    debit: "-",
    credit: "-",
    balance: "$93,140.00",
  },
  {
    date: "Oct 10, 2026",
    description: "Customer Receipts",
    reference: "18 posted receipts",
    debit: "$38,000.00",
    credit: "-",
    balance: "$131,140.00",
  },
  {
    date: "Oct 11, 2026",
    description: "October Payroll",
    reference: "PAY-1026",
    debit: "-",
    credit: "$18,500.00",
    balance: "$95,920.00",
  },
  {
    date: "Oct 12, 2026",
    description: "Software Subscription",
    reference: "EXP-0164",
    debit: "-",
    credit: "$240.00",
    balance: "$95,680.00",
  },
  {
    date: "Oct 21, 2026",
    description: "Business Loan Drawdown",
    reference: "BANK-0086",
    debit: "$5,000.00",
    credit: "-",
    balance: "$98,800.00",
  },
];

export default function GeneralLedger() {
  return (
    <div className="ledger-page">
      <div className="ledger-header">
        <div>
          <h1>General Ledger</h1>
          <p>
            Trace account activity from opening balance to the last
            posted transaction.
          </p>
        </div>

        <button className="print-btn">
          Print Ledger
        </button>
      </div>

      {/* Filters */}
      <div className="ledger-filters">
        <select>
          <option>Oct 1 - 31, 2026</option>
        </select>

        <select>
          <option>1000 - Cash & Bank</option>
        </select>

        <select>
          <option>Posted Entries</option>
        </select>

        <button>Update Report</button>
      </div>

      {/* Summary Cards */}
      <div className="ledger-cards">
        <div className="ledger-card">
          <span>Opening Balance</span>
          <h2>$93,140.00</h2>
        </div>

        <div className="ledger-card">
          <span>Total Debits</span>
          <h2>$92,680.00</h2>
        </div>

        <div className="ledger-card">
          <span>Total Credits</span>
          <h2>$61,240.00</h2>
        </div>

        <div className="ledger-card">
          <span>Closing Balance</span>
          <h2>$124,580.00</h2>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ledger-table-container">
        <div className="ledger-table-header">
          <h3>1000 - Cash & Bank</h3>
          <button>Expand All</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Running Balance</th>
            </tr>
          </thead>

          <tbody>
            {ledgerData.map((item, index) => (
              <tr key={index}>
                <td>{item.date}</td>
                <td>{item.description}</td>
                <td>{item.reference}</td>
                <td>{item.debit}</td>
                <td>{item.credit}</td>
                <td>{item.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-row">
          <span>Period Totals</span>

          <div>
            <strong>Debit:</strong> $92,680.00
          </div>

          <div>
            <strong>Credit:</strong> $61,240.00
          </div>

          <div>
            <strong>Balance:</strong> $124,580.00
          </div>
        </div>
      </div>

      <div className="success-banner">
        ✓ Closing cash balance agrees with Bank Accounts, Trial Balance and Cash Flow Statement.
      </div>
    </div>
  );
}