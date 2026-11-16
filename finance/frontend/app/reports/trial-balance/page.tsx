import React from "react";
import "./trial-balance.css";

const accounts = [
  {
    code: "1010",
    name: "Chase Business - Operating",
    type: "Assets",
    debit: "$84,580.00",
    credit: "-",
  },
  {
    code: "1020",
    name: "Chase Business - Savings",
    type: "Assets",
    debit: "$30,000.00",
    credit: "-",
  },
  {
    code: "1030",
    name: "Wise Business - USD",
    type: "Assets",
    debit: "$10,000.00",
    credit: "-",
  },
  {
    code: "1100",
    name: "Accounts receivable",
    type: "Assets",
    debit: "$48,250.00",
    credit: "-",
  },
  {
    code: "2000",
    name: "Accounts payable",
    type: "Liabilities",
    debit: "-",
    credit: "$32,840.00",
  },
  {
    code: "2100",
    name: "Accrued expenses",
    type: "Liabilities",
    debit: "-",
    credit: "$8,000.00",
  },
  {
    code: "3000",
    name: "Owner capital",
    type: "Equity",
    debit: "-",
    credit: "$80,000.00",
  },
  {
    code: "4000",
    name: "Design services",
    type: "Revenue",
    debit: "-",
    credit: "$74,200.00",
  },
  {
    code: "5000",
    name: "Cost of services",
    type: "Expenses",
    debit: "$24,500.00",
    credit: "-",
  },
  {
    code: "6000",
    name: "Salaries & wages",
    type: "Expenses",
    debit: "$18,500.00",
    credit: "-",
  },
];
export default function TrialBalance() {
  return (
    <div className="trial-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Trial Balance</h1>
          <p>
            Verify that your ledger balances before preparing
            financial statements.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light">Export</button>
          <button className="btn-primary">
            Print Report
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="tabs">
        <button className="active">This month</button>
        <button>This quarter</button>
        <button>This year</button>
        <button>Custom</button>
      </div>

      {/* Filters */}
      <div className="filters">
        <button className="btn-light">
          As of Oct 31, 2026
        </button>

        <button className="btn-light">
          Accrual basis
        </button>

        <button className="btn-light">
          Non-zero accounts
        </button>

        <button className="btn-light push-right">
          Update report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total debits</p>
          <h2>$271,010.00</h2>
          <span>Closing debit balances</span>
        </div>

        <div className="summary-card">
          <p>Total credits</p>
          <h2>$271,010.00</h2>
          <span>Closing credit balances</span>
        </div>

        <div className="summary-card">
          <p>Difference</p>
          <h2>$0.00</h2>
          <span className="green">
            Your trial balance is balanced
          </span>
        </div>

        <div className="summary-card">
          <p>Ledger accounts</p>
          <h2>20</h2>
          <span>With non-zero closing balances</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Acme Studio - Trial Balance</h3>
            <p>
              As of October 31, 2026 • USD •
              Unadjusted for unposted drafts
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Account Type</th>
              <th>Debit Balance</th>
              <th>Credit Balance</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => (
              <tr key={account.code}>
                <td className="account-code">
                  {account.code}
                </td>
                <td>{account.name}</td>
                <td>{account.type}</td>
                <td>{account.debit}</td>
                <td>{account.credit}</td>
              </tr>
            ))}

            <tr className="totals-row">
              <td colSpan={3}>Total balances</td>
              <td>$271,010.00</td>
              <td>$271,010.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Message */}

      <div className="balance-banner">
        ✅ Balanced: total debits equal total credits.
        All balances are drawn from posted ledger
        entries.
      </div>
    </div>
  );
}