import "./invoices.css";

const invoices = [
  {
    id: "INV-1056",
    customer: "Meridian",
    description: "Brand Strategy",
    dueDate: "Nov 25, 2026",
    amount: "$12,000.00",
    balance: "$12,000.00",
    status: "Sent",
  },
  {
    id: "INV-1055",
    customer: "Linear Labs",
    description: "Product Design Sprint",
    dueDate: "Nov 20, 2026",
    amount: "$8,400.00",
    balance: "$8,400.00",
    status: "Sent",
  },
  {
    id: "INV-1040",
    customer: "Northstar Co.",
    description: "September Delivery",
    dueDate: "Oct 16, 2026",
    amount: "$5,000.00",
    balance: "$2,500.00",
    status: "Overdue",
  },
];

export default function ARInvoices() {
  return (
    <div className="ar-page">
      <div className="page-header">
        <div>
          <h1>AR Invoices</h1>
          <p>
            Send customer invoices, track due dates and stay
            on top of receivables.
          </p>
        </div>

        <button className="create-btn">
          Create Invoice
        </button>
      </div>

      {/* Summary Cards */}

      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Receivables</span>
          <h2>$48,250.00</h2>
          <small>24 unpaid customer invoices</small>
        </div>

        <div className="summary-card">
          <span>Current Balance</span>
          <h2>$39,750.00</h2>
          <small>Not yet due</small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>$8,500.00</h2>
          <small className="warning">
            5 customers need follow-up
          </small>
        </div>

        <div className="summary-card">
          <span>Collected This Month</span>
          <h2>$87,680.00</h2>
          <small className="success">
            39 customer receipts
          </small>
        </div>
      </div>

      {/* Tabs */}

      <div className="ar-tabs">
        <button className="active">
          Unpaid Invoices
        </button>
        <button>All Invoices</button>
        <button>Overdue</button>
        <button>Drafts</button>
        <button>Paid</button>
      </div>

      {/* Filters */}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search invoice or customer..."
        />

        <select>
          <option>All Customers</option>
        </select>

        <select>
          <option>Due Date: Any</option>
        </select>

        <button>More Filters</button>
      </div>

      {/* Table */}

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Customer Invoices</h3>
            <p>
              Balances as of October 31, 2026
            </p>
          </div>

          <button className="secondary-btn">
            Send Reminders
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Due Date</th>
              <th>Invoice Amount</th>
              <th>Balance Due</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.id}</td>

                <td>
                  <div>
                    <strong>
                      {invoice.customer}
                    </strong>
                    <p>{invoice.description}</p>
                  </div>
                </td>

                <td>{invoice.dueDate}</td>
                <td>{invoice.amount}</td>
                <td>{invoice.balance}</td>

                <td>
                  <span
                    className={`status ${invoice.status.toLowerCase()}`}
                  >
                    {invoice.status}
                  </span>
                </td>

                <td>
                  <button className="view-btn">
                    View Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="collection-note">
        Recent payment received from Linear Labs.
        Keep customer follow-ups up to date to
        reduce overdue balances.
      </div>
    </div>
  );
}