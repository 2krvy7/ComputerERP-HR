import "./invoices.css";

const invoices = [
  {
    id: "BILL-0294",
    supplier: "AWS",
    category: "Cloud Infrastructure",
    dueDate: "Nov 20, 2026",
    amount: "$6,200.00",
    outstanding: "$6,200.00",
    status: "Open",
  },
  {
    id: "BILL-0293",
    supplier: "Pixel Supply",
    category: "Design Production",
    dueDate: "Nov 15, 2026",
    amount: "$5,800.00",
    outstanding: "$5,800.00",
    status: "Open",
  },
  {
    id: "BILL-0278",
    supplier: "Bright Print",
    category: "Print Collateral",
    dueDate: "Sep 15, 2026",
    amount: "$1,500.00",
    outstanding: "$1,500.00",
    status: "Overdue",
  },
];

export default function APInvoices() {
  return (
    <div className="ap-page">
      <div className="ap-header">
        <div>
          <h1>AP Invoices</h1>
          <p>
            Track supplier bills, upcoming due dates and amounts owed.
          </p>
        </div>

        <button className="new-invoice-btn">
          New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Payables</span>
          <h2>$32,840.00</h2>
          <small>18 unpaid supplier bills</small>
        </div>

        <div className="summary-card">
          <span>Current Balance</span>
          <h2>$27,600.00</h2>
          <small>Not yet due</small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>$5,240.00</h2>
          <small className="danger">
            5 bills need attention
          </small>
        </div>

        <div className="summary-card">
          <span>Paid This Month</span>
          <h2>$18,440.00</h2>
          <small>12 completed payments</small>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search bill or supplier..."
        />

        <select>
          <option>All Suppliers</option>
        </select>

        <select>
          <option>Due Date: Any</option>
        </select>

        <button>More Filters</button>
      </div>

      {/* Invoice Table */}
      <div className="invoice-table-container">
        <div className="table-top">
          <div>
            <h3>Supplier Invoices</h3>
            <p>
              Select invoices to schedule payments
            </p>
          </div>

          <button className="schedule-btn">
            Schedule Payment
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Supplier</th>
              <th>Due Date</th>
              <th>Invoice Amount</th>
              <th>Outstanding</th>
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
                    <strong>{invoice.supplier}</strong>
                    <p>{invoice.category}</p>
                  </div>
                </td>

                <td>{invoice.dueDate}</td>

                <td>{invoice.amount}</td>

                <td>{invoice.outstanding}</td>

                <td>
                  <span
                    className={`status-badge ${invoice.status.toLowerCase()}`}
                  >
                    {invoice.status}
                  </span>
                </td>

                <td>
                  <button className="view-link">
                    View Bill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer-note">
        Keep supplier relationships healthy.
        Prioritize overdue invoices before scheduling
        new payments.
      </div>
    </div>
  );
}