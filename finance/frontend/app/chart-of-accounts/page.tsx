"use client";

import { useEffect, useState } from "react";
import "./chart-of-account.css";

type Account = {
  accountID: number;
  accountCode: string;
  accountName: string;
  accountType: string;
};

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/coa/")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching accounts:", err);
        setLoading(false);
      });
  }, []);

  const totalAccounts = accounts.length;

  return (
    <div className="coa-page">
      {/* Header */}
      <div className="coa-header">
        <div>
          <h1>Chart of Accounts</h1>
          <p>
            Organize your accounts and keep every transaction in the right
            place.
          </p>
        </div>

        <button className="primary-btn">
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="coa-cards">
        <div className="coa-card">
          <h4>Active Accounts</h4>
          <h2>{totalAccounts}</h2>
          <span>Connected to Database</span>
        </div>

        <div className="coa-card">
          <h4>Assets</h4>
          <h2>
            {
              accounts.filter(
                (acc) =>
                  acc.accountType?.toLowerCase() === "asset"
              ).length
            }
          </h2>
        </div>

        <div className="coa-card">
          <h4>Liabilities</h4>
          <h2>
            {
              accounts.filter(
                (acc) =>
                  acc.accountType?.toLowerCase() === "liability"
              ).length
            }
          </h2>
        </div>

        <div className="coa-card">
          <h4>Equity</h4>
          <h2>
            {
              accounts.filter(
                (acc) =>
                  acc.accountType?.toLowerCase() === "equity"
              ).length
            }
          </h2>
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
              <th>ID</th>
              <th>Account Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>Normal Balance</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Loading...</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  No accounts found in database
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.accountID}>
                  <td>{account.accountID}</td>

                  <td>{account.accountName}</td>

                  <td>{account.accountCode}</td>

                  <td>{account.accountType}</td>

                  <td>
                    {["Asset", "Expense"].includes(
                      account.accountType
                    )
                      ? "Debit"
                      : "Credit"}
                  </td>

                  <td>
                    <span className="status active">
                      Active
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}