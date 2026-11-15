import "./payments.css";

const payments = [
  {
    id: "PAY-0088",
    date: "Oct 28, 2026",
    supplier: "Orbit Contractors",
    method: "ACH Transfer",
    invoice: "BILL-0288",
    amount: "$3,000.00",
    status: "Completed",
  },
  {
    id: "PAY-0087",
    date: "Oct 24, 2026",
    supplier: "Pixel Supply",
    method: "ACH Transfer",
    invoice: "BILL-0287",
    amount: "$4,200.00",
    status: "Completed",
  },
  {
    id: "PAY-0086",
    date: "Oct 20, 2026",
    supplier: "Figma",
    method: "Business Card",
    invoice: "BILL-0285",
    amount: "$1,200.00",
    status: "Completed",
  },
  {
    id: "PAY-0085",
    date: "Oct 18, 2026",
    supplier: "Bright Print",
    method: "Bank Transfer",
    invoice: "BILL-0284",
    amount: "$1,800.00",
    status: "Completed",
  },
];

export default function APPayments() {
  return (
    <div className="ap-payments-page">
      <div className="page-header">
        <div>
          <h1>AP Payments</h1>
          <p>
            Record supplier payments and allocate every dollar
            to the right invoice.
          </p>
        </div>

        <button className="primary-btn">
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}

      <div className="summary-grid">
        <div className="summary-card">
          <p>Paid this month</p>
          <h2>$18,440.00</h2>
          <span>12 completed payments</span>
        </div>

        <div className="summary-card">
          <p>Allocated to bills</p>
          <h2>$18,440.00</h2>
          <span>100% allocated</span>
        </div>

        <div className="summary-card">
          <p>Unallocated Amount</p>
          <h2>$0.00</h2>
          <span>No supplier advances</span>
        </div>

        <div className="summary-card">
          <p>Scheduled Payments</p>
          <h2>$5,000.00</h2>
          <span>Studio Lease - November 5</span>
        </div>
      </div>

      {/* Tabs */}

      <div className="payment-tabs">
        <button className="active">Completed</button>
        <button>Scheduled</button>
        <button>Unallocated</button>
        <button>All Payments</button>
      </div>

      {/* Filters */}

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search payment or supplier..."
        />

        <select>
          <option>Oct 1 - 31, 2026</option>
        </select>

        <select>
          <option>All Methods</option>
        </select>

        <button>More Filters</button>
      </div>

      {/* Payment Register */}

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Supplier Payment Register</h3>
            <p>
              Completed payments reduce accounts payable.
            </p>
          </div>

          <button>Payment History</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Method</th>
              <th>Invoice Allocation</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>{payment.date}</td>
                <td>{payment.supplier}</td>
                <td>{payment.method}</td>
                <td>{payment.invoice}</td>
                <td>{payment.amount}</td>
                <td>
                  <span className="status completed">
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="payment-note">
        Allocation complete. All payments are linked
        to supplier invoices.
      </div>
    </div>
  );
}