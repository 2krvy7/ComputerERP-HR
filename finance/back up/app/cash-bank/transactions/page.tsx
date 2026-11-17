import "./transactions.css";

const transactions = [
  {
    date: "Oct 31, 2026",
    description: "Meridian - ACH Credit",
    reference: "BANK-0104",
    amount: 12000,
    category: "Accounts Receivable",
    status: "Match Found",
    action: "Match Invoice",
  },
  {
    date: "Oct 30, 2026",
    description: "Adobe Creative Cloud",
    reference: "BANK-0103",
    amount: -240,
    category: "Software & Subscriptions",
    status: "Needs Category",
    action: "Categorize",
  },
  {
    date: "Oct 28, 2026",
    description: "Orbit Contractors",
    reference: "BANK-0102",
    amount: -3000,
    category: "Accounts Payable",
    status: "Matched",
    action: "Review Match",
  },
  {
    date: "Oct 21, 2026",
    description: "Business Loan Drawdown",
    reference: "BANK-0086",
    amount: 5000,
    category: "Business Loan",
    status: "Reconciled",
    action: "View Entry",
  },
];

export default function Transactions() {
  return (
    <div className="transactions-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>
            Categorize bank activity, match records, and reconcile
            with confidence.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn secondary">Export</button>
          <button className="btn primary">Import Transactions</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Bank Transactions</span>
          <h2>104</h2>
          <small>Across 3 accounts</small>
        </div>

        <div className="stat-card">
          <span>Needs Review</span>
          <h2>12</h2>
          <small>All in Chase Operating</small>
        </div>

        <div className="stat-card">
          <span>Suggested Matches</span>
          <h2>5</h2>
          <small>Ready to match</small>
        </div>

        <div className="stat-card">
          <span>Reconciled</span>
          <h2>92</h2>
          <small>88.5% completed</small>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className="tab active">
          All Transactions
        </button>
        <button className="tab">Needs Review</button>
        <button className="tab">Matched</button>
        <button className="tab">Reconciled</button>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search transaction..."
          className="search"
        />

        <select>
          <option>Chase Operating - 4821</option>
        </select>

        <select>
          <option>Oct 1 - Oct 31, 2026</option>
        </select>

        <button className="filter-btn">
          More Filters
        </button>
      </div>

      {/* Register */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Bank Transaction Register</h3>
            <p>
              Chase Business • Book balance
              $84,580.00
            </p>
          </div>

          <button className="btn secondary">
            Reconcile Selected
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" />
              </th>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Category / Match</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((tx, index) => (
              <tr key={index}>
                <td>
                  <input type="checkbox" />
                </td>

                <td>{tx.date}</td>

                <td>
                  <div className="desc">
                    <strong>{tx.description}</strong>
                    <span>{tx.reference}</span>
                  </div>
                </td>

                <td
                  className={
                    tx.amount > 0
                      ? "amount positive"
                      : "amount negative"
                  }
                >
                  {tx.amount > 0 ? "+" : ""}
                  $
                  {Math.abs(tx.amount).toLocaleString()}
                </td>

                <td>{tx.category}</td>

                <td>
                  <span
                    className={`status ${tx.status
                      .toLowerCase()
                      .replace(/\s/g, "-")}`}
                  >
                    {tx.status}
                  </span>
                </td>

                <td>
                  <button className="link-btn">
                    {tx.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}