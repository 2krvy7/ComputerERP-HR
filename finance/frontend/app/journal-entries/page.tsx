import "./journal-entries.css";

const entries = [
  {
    id: "JE-0096",
    date: "Oct 31, 2026",
    description: "November depreciation template",
    debit: "$500.00",
    credit: "$500.00",
    status: "Draft",
  },
  {
    id: "JE-0095",
    date: "Oct 28, 2026",
    description: "November rent allocation",
    debit: "$5,000.00",
    credit: "$5,000.00",
    status: "Approved",
  },
  {
    id: "JE-0094",
    date: "Oct 21, 2026",
    description: "Business loan drawdown",
    debit: "$5,000.00",
    credit: "$5,000.00",
    status: "Posted",
  },
];

export default function JournalEntries() {
  return (
    <div className="journal-page">
      <div className="page-header">
        <div>
          <h1>Journal Entries</h1>
          <p>Review, approve and post balanced entries.</p>
        </div>

        <button className="new-entry-btn">New Entry</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Entries this month</h3>
          <span>32</span>
        </div>

        <div className="stat-card">
          <h3>Posted entries</h3>
          <span>28</span>
        </div>

        <div className="stat-card">
          <h3>Awaiting approval</h3>
          <span>2</span>
        </div>

        <div className="stat-card">
          <h3>Draft entries</h3>
          <span>2</span>
        </div>
      </div>

      <div className="toolbar">
        <input placeholder="Search entry..." />
        <button>All Sources</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>Entry Register</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>Entry</th>
              <th>Date</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.id}</td>
                <td>{entry.date}</td>
                <td>{entry.description}</td>
                <td>{entry.debit}</td>
                <td>{entry.credit}</td>
                <td>
                  <span
                    className={`status ${entry.status.toLowerCase()}`}
                  >
                    {entry.status}
                  </span>
                </td>
                <td>
                  <button className="view-btn">View Entry</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}