import "./chart-of-account.css";


export default function ChartOfAccounts() {
  return (
    <div className="coa-page">
      {/* Header */}
      <div className="coa-header">
        <div>
          <h1>Chart of Accounts</h1>
          <p>Organize your accounts and keep every transaction in the right place.</p>
        </div>

        <button className="primary-btn">
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="coa-cards">
        <div className="coa-card">
          <h4>Active Accounts</h4>
          <h2>21</h2>
          <span>5 categories</span>
        </div>

        <div className="coa-card">
          <h4>Total Assets</h4>
          <h2>$210,830</h2>
        </div>

        <div className="coa-card">
          <h4>Total Liabilities</h4>
          <h2>$85,840</h2>
        </div>

        <div className="coa-card">
          <h4>Total Equity</h4>
          <h2>$124,990</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="coa-filters">
        <input
          type="text"
          placeholder="Search account..."
          className="search-box"
        />

        <button>Active Accounts</button>
        <button>Tree View</button>
      </div>

      {/* Table */}
      <div className="coa-table-container">
        <div className="table-header">
          <h3>Account Directory</h3>

          <button>Manage Accounts</button>
        </div>

        <table className="coa-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>Normal Balance</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {/* ASSETS */}
            <tr className="group-row">
              <td colSpan={6}>Assets</td>
            </tr>

            <tr>
              <td>Chase Business - Operating</td>
              <td>1010</td>
              <td>Asset</td>
              <td>Debit</td>
              <td>$84,580</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

            <tr>
              <td>Chase Business - Savings</td>
              <td>1020</td>
              <td>Asset</td>
              <td>Debit</td>
              <td>$30,000</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

            {/* LIABILITIES */}
            <tr className="group-row">
              <td colSpan={6}>Liabilities</td>
            </tr>

            <tr>
              <td>Accounts Payable</td>
              <td>2000</td>
              <td>Liability</td>
              <td>Credit</td>
              <td>$32,840</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

            {/* EQUITY */}
            <tr className="group-row">
              <td colSpan={6}>Equity</td>
            </tr>

            <tr>
              <td>Owner Capital</td>
              <td>3000</td>
              <td>Equity</td>
              <td>Credit</td>
              <td>$80,000</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

            {/* REVENUE */}
            <tr className="group-row">
              <td colSpan={6}>Revenue</td>
            </tr>

            <tr>
              <td>Design Services</td>
              <td>4000</td>
              <td>Revenue</td>
              <td>Credit</td>
              <td>$74,200</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

            {/* EXPENSES */}
            <tr className="group-row">
              <td colSpan={6}>Expenses</td>
            </tr>

            <tr>
              <td>Salaries Expense</td>
              <td>6000</td>
              <td>Expense</td>
              <td>Debit</td>
              <td>$18,500</td>
              <td>
                <span className="status active">
                  Active
                </span>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}