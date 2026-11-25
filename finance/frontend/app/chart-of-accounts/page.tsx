"use client";

import { useEffect, useState } from "react";
import "./chart-of-account.css";

// Data shape matching backend ChartOfAccounts records
type Account = {
  accountID: number;
  accountCode: string;
  accountName: string;
  accountType: string;
};

export default function ChartOfAccounts() {
  // Core directory & filter states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Add Account modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Select & Archive workflow states
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archivedIds, setArchivedIds] = useState<number[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Fetch all accounts from FastAPI backend
  async function fetchAccounts() {
    setLoading(true);
    try {
      // FETCH 1: GET http://127.0.0
      // Backend Route: finance/backend/routers/coa.py -> get_accounts()
      // Purpose: Loads active Chart of Accounts records from PostgreSQL
      const res = await fetch("http://127.0.0.1:8000/api/coa");
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => Number(b.accountID || 0) - Number(a.accountID || 0))
        : [];
      setAccounts(sorted);
      
    } catch (err) {
      console.error("Error fetching accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  // Load saved archived IDs from localStorage and fetch accounts on mount
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

  // Persist archived account IDs locally
  function saveArchivedIds(nextIds: number[]) {
    setArchivedIds(nextIds);
    localStorage.setItem("coa_archived_ids", JSON.stringify(nextIds));
  }

  // Create a new account via POST /api/coa
  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      // FETCH 2: POST http://127.0.0
      // Backend Route: finance/backend/routers/coa.py -> create_account()
      // Purpose: Saves a new account into ChartOfAccounts
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

  // Toggle row selection checkboxes on/off
  function handleToggleSelectMode() {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds([]);
    } else {
      setIsSelectMode(true);
    }
  }

  // Check or uncheck a single account row
  function handleToggleRow(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Move checked accounts into the Archive list
  function handleMoveToArchive() {
    if (selectedIds.length === 0) {
      alert("Please select at least one account checkbox to move to Archive.");
      return;
    }
    const nextArchived = Array.from(new Set([...archivedIds, ...selectedIds]));
    saveArchivedIds(nextArchived);
    setSelectedIds([]);
  }

  // Restore a single archived account back to the active directory
  function handleRestoreAccount(id: number) {
    const nextArchived = archivedIds.filter((item) => item !== id);
    saveArchivedIds(nextArchived);
  }

  // Restore all archived accounts at once
  function handleRestoreAll() {
    saveArchivedIds([]);
  }

  // Separate active vs archived accounts
  const activeAccounts = accounts.filter(
    (acc) => !archivedIds.includes(acc.accountID)
  );
  const archivedAccounts = accounts.filter((acc) =>
    archivedIds.includes(acc.accountID)
  );

  // Filter active accounts by dropdown type and search query
  const filteredAccounts = activeAccounts.filter((acc) => {
    const accTypeLow = (acc.accountType || "").toLowerCase();
    if (typeFilter !== "ALL" && accTypeLow !== typeFilter.toLowerCase()) {
      return false;
    }

    const q = search.toLowerCase();
    return (
      acc.accountCode?.toLowerCase().includes(q) ||
      acc.accountName?.toLowerCase().includes(q) ||
      accTypeLow.includes(q)
    );
  });

  // Check or uncheck all visible filtered rows
  function handleToggleSelectAll() {
    if (selectedIds.length === filteredAccounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map((acc) => acc.accountID));
    }
  }


    return (
    <div className="coa-page">
      {/* Fixed Aligned Page Header */}
      <div className="coa-header">
        <h1>Chart of Accounts</h1>

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

      {/* Summary Metric Cards */}
      <div className="coa-cards">
        <div className="coa-card">
          <h4>Active Accounts</h4>
          <h2>{activeAccounts.length}</h2>
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

      {/* Search Bar & Account Type Dropdown Filter */}
      <div className="coa-filters">
        <input
          type="text"
          placeholder="Search account code, name, or type..."
          className="search-box"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="type-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by account type"
        >
          <option value="ALL">All Accounts</option>
          <option value="Asset">Asset</option>
          <option value="Liability">Liabilities</option>
          <option value="Equity">Equity</option>
          <option value="Revenue">Revenue</option>
          <option value="Expense">Expense</option>
        </select>

        <button className="refresh-btn" onClick={fetchAccounts}>
          Refresh
        </button>
      </div>

      {/* Centered Account Directory Table */}
      <div className="coa-table-container">
        <div className="table-header">
          <h3>Account Directory</h3>

          <div className="table-actions">
            <button
              className={`select-mode-btn ${isSelectMode ? "active" : ""}`}
              onClick={handleToggleSelectMode}
            >
              {isSelectMode ? "Done Selecting" : "Select"}
            </button>

            {isSelectMode ? (
              <button
                className="archive-confirm-btn"
                onClick={handleMoveToArchive}
              >
                Archive Selected ({selectedIds.length})
              </button>
            ) : (
              <button
                className="archive-btn"
                onClick={() => setShowArchiveModal(true)}
              >
                Archive ({archivedAccounts.length})
              </button>
            )}
          </div>
        </div>

        <table className="coa-table">
          <thead>
            <tr>
              {isSelectMode && (
                <th className="coa-checkbox-col">
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
                <td colSpan={isSelectMode ? 7 : 6}>Loading accounts...</td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={isSelectMode ? 7 : 6}>
                  No active accounts found matching your filter.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => {
                const isChecked = selectedIds.includes(account.accountID);
                return (
                  <tr
                    key={account.accountID}
                    className={isChecked ? "row-selected" : undefined}
                  >
                    {isSelectMode && (
                      <td className="coa-checkbox-col">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(account.accountID)}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {/* Add New Account Modal */}
      {showAddModal && (
        <div className="coa-modal-overlay">
          <form className="coa-modal-card" onSubmit={handleAddAccount}>
            <div className="coa-modal-header">
              <h3>Add New Account</h3>
            </div>

            {formError && <p className="coa-form-error">{formError}</p>}

            <div className="coa-form-group">
              <label>Account Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. 5010"
                className="coa-form-input"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
              />
            </div>

            <div className="coa-form-group">
              <label>Account Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Production Cost"
                className="coa-form-input"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>

            <div className="coa-form-group">
              <label>Account Type *</label>
              <select
                className="coa-form-input"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                <option value="Asset">Asset (Normal: Debit)</option>
                <option value="Liability">Liability (Normal: Credit)</option>
                <option value="Equity">Equity (Normal: Credit)</option>
                <option value="Revenue">Revenue (Normal: Credit)</option>
                <option value="Expense">Expense (Normal: Debit)</option>
              </select>
            </div>

            <div className="coa-modal-footer">
              <button
                type="button"
                className="coa-cancel-btn"
                onClick={() => setShowAddModal(false)}
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
        <div className="coa-modal-overlay">
          <div className="coa-modal-card wide">
            <div className="coa-modal-header">
              <h3>Archived Accounts ({archivedAccounts.length})</h3>
              {archivedAccounts.length > 0 && (
                <button
                  className="coa-restore-all-btn"
                  onClick={handleRestoreAll}
                >
                  Restore All
                </button>
              )}
            </div>

            {archivedAccounts.length === 0 ? (
              <p className="coa-empty-note">
                No archived accounts. Click <strong>Select</strong> on the
                directory table to choose accounts to archive.
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
                          className="coa-restore-btn"
                          onClick={() => handleRestoreAccount(acc.accountID)}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="coa-modal-footer">
              <button
                className="coa-cancel-btn"
                onClick={() => setShowArchiveModal(false)}
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
