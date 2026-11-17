"use client";

import { useEffect, useMemo, useState } from "react";
import "./accounts.css";

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Reconciliation status
  const [bankFilter, setBankFilter] = useState("ALL");
  const [reconciledIds, setReconciledIds] = useState<number[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [formBankName, setFormBankName] = useState("");
  const [formAccountNum, setFormAccountNum] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // View Transactions Modal
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/bank/");
      if (!res.ok) throw new Error(`Bank API error: ${res.status}`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const stats = useMemo(() => {
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalInflows = accounts.reduce((s, a) => s + Number(a.totalIn || 0), 0);
    const totalOutflows = accounts.reduce((s, a) => s + Number(a.totalOut || 0), 0);
    const needsRecon = accounts.filter(
      (a) => !reconciledIds.includes(a.bankAccountID)
    ).length;

    return {
      totalCash,
      totalInflows,
      totalOutflows,
      connectedCount: accounts.length,
      needsRecon,
    };
  }, [accounts, reconciledIds]);

  const filteredAccounts = useMemo(() => {
    if (bankFilter === "ALL") return accounts;
    return accounts.filter((a) => a.bankName === bankFilter);
  }, [accounts, bankFilter]);

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!formBankName.trim() || !formAccountNum.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: formBankName,
          accountNumber: formAccountNum,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to add bank account");
      }
      setShowAddModal(false);
      setFormBankName("");
      setFormAccountNum("");
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewTransactions(account: any) {
    setSelectedAccount(account);
    setTxLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0${account.bankAccountID}/transactions`
      );
      if (res.ok) {
        setTransactions(await res.json());
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }

  function toggleReconcile(bankAccountID: number) {
    setReconciledIds((prev) =>
      prev.includes(bankAccountID)
        ? prev.filter((id) => id !== bankAccountID)
        : [...prev, bankAccountID]
    );
  }

  return (
    <div className="bank-page">
      <div className="page-header">
        <div>
          <h1>Bank Accounts</h1>
          <p>A single view of your cash and reconciliation progress.</p>
        </div>

        <div className="header-actions">
          <button className="btn secondary" onClick={() => window.print()}>
            Export
          </button>
          <button className="btn primary" onClick={() => setShowAddModal(true)}>
            Add Account
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Cash Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.totalCash)}</h2>
          <small>
            In: {formatCurrency(stats.totalInflows)} • Out: {formatCurrency(stats.totalOutflows)}
          </small>
        </div>

        <div className="stat-card">
          <span>Connected Accounts</span>
          <h2>{loading ? "..." : stats.connectedCount}</h2>
          <small>Synced with PostgreSQL</small>
        </div>

        <div className="stat-card">
          <span>Needs Reconciliation</span>
          <h2>{loading ? "..." : stats.needsRecon}</h2>
          <small>
            {stats.needsRecon === 0 ? "All accounts reconciled" : "Pending statement review"}
          </small>
        </div>

        <div className="stat-card">
          <span>Sync Status</span>
          <h2>Live</h2>
          <small>Connected to AR & AP feeds</small>
        </div>
      </div>

      <div className="filters">
        <button
          className={bankFilter === "ALL" ? "filter-btn active" : "filter-btn"}
          onClick={() => setBankFilter("ALL")}
        >
          All Institutions
        </button>
        {Array.from(new Set(accounts.map((a) => a.bankName))).map((name) => (
          <button
            key={name}
            className={bankFilter === name ? "filter-btn active" : "filter-btn"}
            onClick={() => setBankFilter(name)}
          >
            {name}
          </button>
        ))}

        <button className="more-filter" onClick={fetchAccounts}>
          Refresh Feed
        </button>
      </div>

      {loading ? (
        <p style={{ padding: "1rem" }}>Loading bank accounts...</p>
      ) : error ? (
        <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
      ) : filteredAccounts.length === 0 ? (
        <p style={{ padding: "1rem" }}>
          No bank accounts found. Click <strong>Add Account</strong> to register one.
        </p>
      ) : (
        <div className="accounts-grid">
          {filteredAccounts.map((account) => {
            const isRecon = reconciledIds.includes(account.bankAccountID);
            return (
              <div key={account.bankAccountID} className="account-card">
                <div className="card-header">
                  <div>
                    <h3>{account.bankName}</h3>
                    <span>Account #{account.bankAccountID}</span>
                  </div>

                  <button
                    className="menu-btn"
                    onClick={() => handleViewTransactions(account)}
                    title="View Transactions"
                  >
                    •••
                  </button>
                </div>

                <div className="balance">{formatCurrency(account.balance)}</div>

                <p className="account-meta">
                  Acct No: {account.accountNumber} • {account.transactionCount} posted txns
                </p>

                <div className="status-row">
                  <span className="badge">
                    {isRecon ? "Reconciled" : "Feed Connected"}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="btn secondary"
                    onClick={() => handleViewTransactions(account)}
                  >
                    View Transactions
                  </button>

                  <button
                    className="btn secondary"
                    onClick={() => toggleReconcile(account.bankAccountID)}
                  >
                    {isRecon ? "Unmark" : "Reconcile"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="statements-card">
        <div className="table-header">
          <div>
            <h3>Bank Statements</h3>
            <p>Compare statement balances with your books.</p>
          </div>

          <button className="btn secondary" onClick={fetchAccounts}>
            Sync Balances
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Cash Inflows / Outflows</th>
              <th>Closing Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                  No bank statements available yet.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => {
                const isRecon = reconciledIds.includes(acc.bankAccountID);
                return (
                  <tr key={acc.bankAccountID}>
                    <td>
                      {acc.bankName} - {acc.accountNumber}
                    </td>
                    <td>
                      +{formatCurrency(acc.totalIn)} / -{formatCurrency(acc.totalOut)}
                    </td>
                    <td>{formatCurrency(acc.balance)}</td>
                    <td>
                      <span className={isRecon ? "status success" : "status warning"}>
                        {isRecon ? "Reconciled" : `${acc.transactionCount} txns to review`}
                      </span>
                    </td>
                    <td>
                      <button
                        className="link-btn"
                        onClick={() => toggleReconcile(acc.bankAccountID)}
                      >
                        {isRecon ? "Reconciled ✓" : "Reconcile"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Bank Account Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleAddAccount}
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>Add Bank Account</h3>

            <label>Bank Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. BDO Corporate Checking"
              value={formBankName}
              onChange={(e) => setFormBankName(e.target.value)}
            />

            <label>Account Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. 0048-2910-4821"
              value={formAccountNum}
              onChange={(e) => setFormAccountNum(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Saving..." : "Save Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Transactions Modal */}
      {selectedAccount && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "520px",
              maxHeight: "80vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>
              {selectedAccount.bankName} ({selectedAccount.accountNumber})
            </h3>
            <p>
              <strong>Current Balance:</strong> {formatCurrency(selectedAccount.balance)}
            </p>

            {txLoading ? (
              <p>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p>No AP payments or AR receipts recorded on this account yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Ref</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.id}</td>
                      <td>{tx.type}</td>
                      <td>{tx.reference}</td>
                      <td>{formatDate(tx.date)}</td>
                      <td style={{ color: tx.direction === "IN" ? "green" : "crimson" }}>
                        {tx.direction === "IN" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button className="btn secondary" onClick={() => setSelectedAccount(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}