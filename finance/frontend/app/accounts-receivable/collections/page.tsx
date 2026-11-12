import "./collections.css";

const collections = [
  {
    customer: "Nova Ventures",
    invoice: "INV-1014",
    outstanding: "$1,000.00",
    overdue: "$1,000.00",
    priority: "High",
    status: "Escalated",
    nextActivity: "Call • Nov 2",
  },
  {
    customer: "Atlas Digital",
    invoice: "INV-1032",
    outstanding: "$9,100.00",
    overdue: "$2,000.00",
    priority: "High",
    status: "Promise to Pay",
    nextActivity: "Check Payment • Nov 3",
  },
  {
    customer: "Northstar Co.",
    invoice: "INV-1040",
    outstanding: "$8,750.00",
    overdue: "$2,500.00",
    priority: "Medium",
    status: "Promise to Pay",
    nextActivity: "Check Payment • Nov 5",
  },
];

export default function Collections() {
  return (
    <div className="collections-page">
      <div className="page-header">
        <div>
          <h1>Collections</h1>
          <p>
            Prioritize overdue customers, send reminders
            and follow through on payment promises.
          </p>
        </div>

        <button className="primary-btn">
          Send Reminders
        </button>
      </div>

      {/* Metrics */}

      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Balance</span>
          <h2>$48,250.00</h2>
          <small>7 customers • 24 invoices</small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>$8,500.00</h2>
          <small className="warning">
            17.6% of receivables
          </small>
        </div>

        <div className="summary-card">
          <span>High Priority Balance</span>
          <h2>$4,200.00</h2>
          <small className="warning">
            3 customers over 30 days
          </small>
        </div>

        <div className="summary-card">
          <span>Promises To Pay</span>
          <h2>$4,500.00</h2>
          <small className="success">
            Due next week
          </small>
        </div>
      </div>

      {/* Tabs */}

      <div className="collections-tabs">
        <button className="active">
          All Customers
        </button>
        <button>High Priority</button>
        <button>Promises To Pay</button>
        <button>No Response</button>
      </div>

      {/* Filters */}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search customer or invoice..."
        />

        <select>
          <option>All Owners</option>
        </select>

        <select>
          <option>Next Follow-up: Any</option>
        </select>

        <button>More Filters</button>
      </div>

      {/* Worklist */}

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Collection Worklist</h3>
            <p>
              Prioritized by age and balance
            </p>
          </div>

          <button className="secondary-btn">
            Assign Owner
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Outstanding</th>
              <th>Overdue</th>
              <th>Priority</th>
              <th>Follow-up Status</th>
              <th>Next Activity</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {collections.map((row, index) => (
              <tr key={index}>
                <td>
                  <strong>{row.customer}</strong>
                  <p>{row.invoice}</p>
                </td>

                <td>{row.outstanding}</td>

                <td>{row.overdue}</td>

                <td>
                  <span
                    className={`priority ${row.priority.toLowerCase()}`}
                  >
                    {row.priority}
                  </span>
                </td>

                <td>
                  <span className="status">
                    {row.status}
                  </span>
                </td>

                <td>{row.nextActivity}</td>

                <td>
                  <button className="link-btn">
                    Send Reminder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="collection-note">
        Follow-up schedule:
        November 2 call Nova Ventures.
        November 3 confirm Atlas Digital payment.
      </div>
    </div>
  );
}