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
  const [search, setSearch] = useState("");

  // Add Account Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modify & Archive States
  const [isModifyMode, setIsModifyMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archivedIds, setArchivedIds] = useState<number[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/coa");
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("coa_archived_ids");
    if (saved) {
      try {
        setArchivedIds(JSON.parse(saved));
      } catch {
        setArchivedIds([]);
      }
    }
    fetchAccounts();
  }, []);

  function saveArchivedIds(nextIds: number[]) {
    setArchivedIds(nextIds);
    localStorage.setItem("coa_archived_ids", JSON.stringify(nextIds));
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/coa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode,
          accountName,
          accountType,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to add account");
      }

      setAccountCode("");
      setAccountName("");
      setAccountType("Asset");
      setShowAddModal(false);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || "Error saving account");
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleModify() {
    if (isModifyMode) {
      // Deactivate modify mode and clear selections
      setIsModifyMode(false);
      setSelectedIds([]);
    } else {
      setIsModifyMode(true);
    }
  }

  function handleToggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleDeleteToArchive() {
    if (selectedIds.length === 0) {
      alert("Please select at least one account checkbox to move to Archive.");
      return;
    }
    const nextArchived = Array.from(new Set([...archivedIds, ...selectedIds]));
    saveArchivedIds(nextArchived);
    setSelectedIds([]);
  }

  function handleRestoreAccount(id: number) {
    const nextArchived = archivedIds.filter((item) => item !== id);
    saveArchivedIds(nextArchived);
  }

  function handleRestoreAll() {
    saveArchivedIds([]);
  }

  const activeAccounts = accounts.filter(
    (acc) => !archivedIds.includes(acc.accountID)
  );
  const archivedAccounts = accounts.filter((acc) =>
    archivedIds.includes(acc.accountID)
  );

  const filteredAccounts = activeAccounts.filter((acc) => {
    const q = search.toLowerCase();
    return (
      acc.accountCode?.toLowerCase().includes(q) ||
      acc.accountName?.toLowerCase().includes(q) ||
      acc.accountType?.toLowerCase().includes(q)
    );
  });

  function handleToggleSelectAll() {
    if (selectedIds.length === filteredAccounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map((acc) => acc.accountID));
    }
  }

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

        <button
          className="primary-btn"
          onClick={() => {
            setFormError(null);
            setShowAddModal(true);
          }}
        >
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="coa-cards">
        <div className="coa-card">
          <h4>Active Accounts</h4>
          <h2>{activeAccounts.length}</h2>
          <span>Connected to Database</span>
        </div>

        <div className="coa-card">
          <h4>Assets</h4>
          <h2>
            {
              activeAccounts.filter(
                (acc) => acc.accountType?.toLowerCase() === "asset"
              ).length
            }
          </h2>
        </div>

        <div className="coa-card">
          <h4>Liabilities</h4>
          <h2>
            {
              activeAccounts.filter(
                (acc) => acc.accountType?.toLowerCase() === "liability"
              ).length
            }
          </h2>
        </div>

        <div className="coa-card">
          <h4>Equity</h4>
          <h2>
            {
              activeAccounts.filter(
                (acc) => acc.accountType?.toLowerCase() === "equity"
              ).length
            }
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="coa-filters">
        <input
          type="text"
          placeholder="Search account code, name, or type..."
          className="search-box"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button onClick={() => setSearch("")}>All Accounts</button>
        <button onClick={fetchAccounts}>Refresh</button>
      </div>

      {/* Table */}
      <div className="coa-table-container">
        <div className="table-header">
          <h3>Account Directory</h3>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              onClick={handleToggleModify}
              style={
                isModifyMode
                  ? {
                      backgroundColor: "#dc2626",
                      color: "#ffffff",
                      border: "1px solid #dc2626",
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              {isModifyMode ? "Modify (Active)" : "Modify"}
            </button>

            {isModifyMode ? (
              <button
                onClick={handleDeleteToArchive}
                style={{
                  backgroundColor: "#991b1b",
                  color: "#ffffff",
                  border: "1px solid #991b1b",
                  fontWeight: 600,
                }}
              >
                Delete ({selectedIds.length})
              </button>
            ) : (
              <button onClick={() => setShowArchiveModal(true)}>
                Archive ({archivedAccounts.length})
              </button>
            )}
          </div>
        </div>

        <table className="coa-table">
          <thead>
            <tr>
              {isModifyMode && (
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredAccounts.length > 0 &&
                      selectedIds.length === filteredAccounts.length
                    }
                    onChange={handleToggleSelectAll}
                  />
                </th>
              )}
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
                <td colSpan={isModifyMode ? 7 : 6}>Loading...</td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={isModifyMode ? 7 : 6}>
                  No active accounts found in database
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.accountID}>
                  {isModifyMode && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(account.accountID)}
                        onChange={() => handleToggleSelect(account.accountID)}
                      />
                    </td>
                  )}
                  <td>{account.accountID}</td>
                  <td>{account.accountName}</td>
                  <td>{account.accountCode}</td>
                  <td>{account.accountType}</td>
                  <td>
                    {["Asset", "Expense"].includes(account.accountType)
                      ? "Debit"
                      : "Credit"}
                  </td>
                  <td>
                    <span className="status active">Active</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

       {/* Add Account Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleAddAccount}
            style={{
              backgroundColor: "#ffffff",
              padding: "1.5rem",
              borderRadius: "10px",
              width: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3 style={{ margin: 0 }}>Add New Account</h3>

            {formError && (
              <p style={{ color: "crimson", fontSize: "0.9rem", margin: 0 }}>
                {formError}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Account Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. 5010"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Account Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Production Cost"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Account Type *</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                <option value="Asset">Asset (Normal: Debit)</option>
                <option value="Liability">Liability (Normal: Credit)</option>
                <option value="Equity">Equity (Normal: Credit)</option>
                <option value="Revenue">Revenue (Normal: Credit)</option>
                <option value="Expense">Expense (Normal: Debit)</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Archive & Restore Modal */}
      {showArchiveModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "1.5rem",
              borderRadius: "10px",
              width: "560px",
              maxHeight: "80vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Archived Accounts ({archivedAccounts.length})</h3>
              {archivedAccounts.length > 0 && (
                <button
                  onClick={handleRestoreAll}
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    border: "1px solid #16a34a",
                    backgroundColor: "#16a34a",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Restore All
                </button>
              )}
            </div>

            {archivedAccounts.length === 0 ? (
              <p style={{ color: "#666", margin: "0.5rem 0" }}>
                No archived accounts. Click <strong>Modify</strong> on the directory table to select and archive accounts.
              </p>
            ) : (
              <table className="coa-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedAccounts.map((acc) => (
                    <tr key={acc.accountID}>
                      <td>{acc.accountCode}</td>
                      <td>{acc.accountName}</td>
                      <td>{acc.accountType}</td>
                      <td>
                        <button
                          onClick={() => handleRestoreAccount(acc.accountID)}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "6px",
                            border: "1px solid #2563eb",
                            backgroundColor: "#2563eb",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowArchiveModal(false)}
                style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}