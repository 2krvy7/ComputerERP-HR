import "./accounts.css";

const accounts = [
  {
    name: "Chase Business",
    type: "Checking",
    balance: 84580,
    account: "4821",
    ledger: "1010",
    status: "Feed Connected",
  },
  {
    name: "Chase Business",
    type: "Savings Reserve",
    balance: 30000,
    account: "9973",
    ledger: "1020",
    status: "Feed Connected",
  },
  {
    name: "Wise Business",
    type: "USD Business Account",
    balance: 10000,
    account: "6158",
    ledger: "1030",
    status: "Feed Connected",
  },
];

const statements = [
  {
    account: "Chase Operating - 4821",
    period: "Oct 1 - Oct 31, 2026",
    balance: "$84,580.00",
    status: "12 to review",
  },
  {
    account: "Chase Savings - 9973",
    period: "Oct 1 - Oct 31, 2026",
    balance: "$30,000.00",
    status: "Reconciled",
  },
  {
    account: "Wise USD - 6158",
    period: "Oct 1 - Oct 31, 2026",
    balance: "$10,000.00",
    status: "Reconciled",
  },
];

export default function BankAccounts() {
  return (
    <div className="bank-page">
      <div className="page-header">
        <div>
          <h1>Bank Accounts</h1>
          <p>A single view of your cash and reconciliation progress.</p>
        </div>

        <div className="header-actions">
          <button className="btn secondary">Export</button>
          <button className="btn primary">Add Account</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Cash Balance</span>
          <h2>$124,580.00</h2>
          <small>+ $31,440 this month</small>
        </div>

        <div className="stat-card">
          <span>Connected Accounts</span>
          <h2>3</h2>
          <small>All feeds connected</small>
        </div>

        <div className="stat-card">
          <span>Needs Reconciliation</span>
          <h2>12</h2>
          <small>Chase Operating Statement</small>
        </div>

        <div className="stat-card">
          <span>Last Synced</span>
          <h2>4 min ago</h2>
          <small>All accounts up to date</small>
        </div>
      </div>

      <div className="filters">
        <button className="filter-btn active">All Institutions</button>
        <button className="filter-btn">USD Accounts</button>

        <button className="more-filter">More Filters</button>
      </div>

      <div className="accounts-grid">
        {accounts.map((account, index) => (
          <div key={index} className="account-card">
            <div className="card-header">
              <div>
                <h3>{account.name}</h3>
                <span>{account.type}</span>
              </div>

              <button className="menu-btn">•••</button>
            </div>

            <div className="balance">
              $
              {account.balance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>

            <p className="account-meta">
              Account {account.account} • Ledger {account.ledger}
            </p>

            <div className="status-row">
              <span className="badge">{account.status}</span>
            </div>

            <div className="card-actions">
              <button className="btn secondary">
                View Transactions
              </button>

              <button className="btn secondary">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="statements-card">
        <div className="table-header">
          <div>
            <h3>Bank Statements</h3>
            <p>Compare statement balances with your books.</p>
          </div>

          <button className="btn secondary">
            Import Statement
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Statement Period</th>
              <th>Closing Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {statements.map((statement, i) => (
              <tr key={i}>
                <td>{statement.account}</td>
                <td>{statement.period}</td>
                <td>{statement.balance}</td>
                <td>
                  <span
                    className={
                      statement.status === "Reconciled"
                        ? "status success"
                        : "status warning"
                    }
                  >
                    {statement.status}
                  </span>
                </td>
                <td>
                  <button className="link-btn">
                    Reconcile
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