"use client";

import { useEffect, useMemo, useState } from "react";
import "./transactions.css";

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<
    "ALL" | "Needs Review" | "Matched" | "Reconciled"
  >("ALL");
  const [search, setSearch] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selection & Reconciliation state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<
    Record<string, string>
  >({});

  // Inspect / Categorize Modal
  const [inspectTx, setInspectTx] = useState<any | null>(null);
  const [editCategory, setEditCategory] = useState("");

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [txRes, bankRes] = await Promise.all([
        // FETCH 1: GET ${API_URL}/api/transactions
        // Backend File: finance/backend/routers/transactions.py -> get_bank_transactions()
        // Database Tables: Reads "ARReceipt", "APPayment", and approved Payroll/Expenses from "JournalEntry"
        // Purpose: Loads all bank inflows and outflows for the Bank Transaction Register
        fetch(`${API_URL}/api/transactions`),

        // FETCH 2: GET ${API_URL}/api/bank
        // Backend File: finance/backend/routers/bank.py -> get_bank_accounts()
        // Database Tables: Reads all registered "BankAccount" rows with live balances
        // Purpose: Populates every registered bank account in the All Bank Accounts dropdown
        fetch(`${API_URL}/api/bank`),
      ]);

      if (!txRes.ok) throw new Error(`Transactions API error: ${txRes.status}`);
      const txJson = await txRes.json();
      setTransactions(Array.isArray(txJson) ? txJson : []);

      if (bankRes.ok) {
        const bankJson = await bankRes.json();
        setBankAccounts(Array.isArray(bankJson) ? bankJson : []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bank transactions");
    } finally {
      setLoading(false);
    }
  }

  // Philippine Peso (PHP) currency formatter
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(Number(val || 0)));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  // Enrich transactions and sort newest on top (date DESC, then numeric ID DESC)
  const enrichedTransactions = useMemo(() => {
    return transactions
      .map((tx) => {
        const isReconciled = reconciledIds.includes(tx.id);
        const category =
          customCategories[tx.id] ?? tx.category ?? "Uncategorized";
        const status = isReconciled
          ? "Reconciled"
          : category === "Uncategorized"
          ? "Needs Review"
          : tx.status ?? "Matched";
        const isoDate = tx.date
          ? new Date(tx.date).toISOString().split("T")
          : "";

        return {
          ...tx,
          isoDate,
          dateFormatted: formatDate(tx.date),
          category,
          status,
          action: isReconciled ? "View Entry" : "Review Match",
        };
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        const numA = Number(String(a.id ?? "").replace(/\D/g, "")) || 0;
        const numB = Number(String(b.id ?? "").replace(/\D/g, "")) || 0;
        return numB - numA;
      });
  }, [transactions, reconciledIds, customCategories]);

  const stats = useMemo(() => {
    const totalCount = enrichedTransactions.length;
    const needsReviewCount = enrichedTransactions.filter(
      (t) => t.status === "Needs Review"
    ).length;
    const matchedCount = enrichedTransactions.filter(
      (t) => t.status === "Matched"
    ).length;
    const reconciledCount = enrichedTransactions.filter(
      (t) => t.status === "Reconciled"
    ).length;
    const reconPct =
      totalCount > 0 ? ((reconciledCount / totalCount) * 100).toFixed(1) : "0.0";

    return {
      totalCount,
      accountCount: bankAccounts.length,
      needsReviewCount,
      matchedCount,
      reconciledCount,
      reconPct,
    };
  }, [enrichedTransactions, bankAccounts]);

  const filteredTransactions = useMemo(() => {
    return enrichedTransactions.filter((tx) => {
      if (activeTab !== "ALL" && tx.status !== activeTab) return false;
      if (
        selectedBankId !== "ALL" &&
        String(tx.bankAccountID) !== selectedBankId
      )
        return false;
      if (startDate && tx.isoDate && tx.isoDate < startDate) return false;
      if (endDate && tx.isoDate && tx.isoDate > endDate) return false;

      if (search) {
        const q = search.toLowerCase();
        const match =
          String(tx.description || "").toLowerCase().includes(q) ||
          String(tx.reference || "").toLowerCase().includes(q) ||
          String(tx.category || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    enrichedTransactions,
    activeTab,
    selectedBankId,
    startDate,
    endDate,
    search,
  ]);

  const activeBookBalance = useMemo(() => {
    if (selectedBankId === "ALL") {
      return bankAccounts.reduce((s, b) => s + Number(b.balance || 0), 0);
    }
    const found = bankAccounts.find(
      (b) => String(b.bankAccountID) === selectedBankId
    );
    return found ? Number(found.balance || 0) : 0;
  }, [bankAccounts, selectedBankId]);

  const activeBankName = useMemo(() => {
    if (selectedBankId === "ALL") return "All Bank Accounts";
    const found = bankAccounts.find(
      (b) => String(b.bankAccountID) === selectedBankId
    );
    return found
      ? `${found.bankName} (${found.accountNumber})`
      : "Selected Account";
  }, [bankAccounts, selectedBankId]);

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map((t) => t.id));
    }
  }

  function handleReconcileSelected() {
    if (selectedIds.length === 0) {
      alert("Select at least one transaction checkbox first.");
      return;
    }
    setReconciledIds((prev) => Array.from(new Set([...prev, ...selectedIds])));
    setSelectedIds([]);
  }
  return (
    <div className="transactions-page">
      {/* Aligned Fixed Header (No subtitle, no Export button) */}
      <div className="page-header">
        <h1>Transactions</h1>

        <div className="header-actions">
          <button
            type="button"
            className="btn primary"
            onClick={fetchData}
          >
            Sync Transactions
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Bank Transactions</span>
          <h2>{loading ? "..." : stats.totalCount}</h2>
          <small>
            Across {stats.accountCount}{" "}
            {stats.accountCount === 1 ? "account" : "accounts"}
          </small>
        </div>

        <div className="stat-card">
          <span>Needs Review</span>
          <h2>{loading ? "..." : stats.needsReviewCount}</h2>
          <small>Uncategorized activity</small>
        </div>

        <div className="stat-card">
          <span>Matched Records</span>
          <h2>{loading ? "..." : stats.matchedCount}</h2>
          <small>Linked to AP, AR &amp; Payroll</small>
        </div>

        <div className="stat-card">
          <span>Reconciled</span>
          <h2>{loading ? "..." : stats.reconciledCount}</h2>
          <small>{stats.reconPct}% completed</small>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(["ALL", "Needs Review", "Matched", "Reconciled"] as const).map(
          (tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "ALL" ? "All Transactions" : tab}
            </button>
          )
        )}
      </div>

      {/* Filters (All registered bank accounts shown in dropdown) */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search transaction..."
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={selectedBankId}
          onChange={(e) => setSelectedBankId(e.target.value)}
          aria-label="Filter by Bank Account"
        >
          <option value="ALL">All Bank Accounts</option>
          {Array.from(
            new Map(
              bankAccounts.map((b) => [String(b.bankAccountID), b])
            ).values()
          ).map((b, idx) => (
            <option
              key={`${b.bankAccountID}-${idx}`}
              value={String(b.bankAccountID)}
            >
              {b.bankName} - {b.accountNumber}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="date-input"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          title="Start Date"
        />

        <input
          type="date"
          className="date-input"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          title="End Date"
        />

        <button
          type="button"
          className="filter-btn"
          onClick={() => {
            setSearch("");
            setSelectedBankId("ALL");
            setStartDate("");
            setEndDate("");
            setActiveTab("ALL");
          }}
        >
          Reset Filters
        </button>
      </div>
      {/* Register (Newest transactions on top) */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Bank Transaction Register</h3>
            <p>
              {activeBankName} • Book balance {formatCurrency(activeBookBalance)}
            </p>
          </div>

          <button
            type="button"
            className="btn secondary"
            onClick={handleReconcileSelected}
          >
            Reconcile Selected ({selectedIds.length})
          </button>
        </div>

        {loading ? (
          <p className="state-message">Loading bank transactions...</p>
        ) : error ? (
          <p className="state-message error">Error: {error}</p>
        ) : (
          <table className="tx-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      filteredTransactions.length > 0 &&
                      selectedIds.length === filteredTransactions.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Category / Match</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    No bank transactions recorded yet.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tx.id)}
                        onChange={() => toggleSelectRow(tx.id)}
                      />
                    </td>

                    <td>{tx.dateFormatted}</td>

                    <td>
                      <div className="desc">
                        <strong>{tx.description}</strong>
                        <span>
                          {tx.reference} • {tx.bankAccountLabel}
                        </span>
                      </div>
                    </td>

                    <td
                      className={
                        tx.amount >= 0 ? "amount positive" : "amount negative"
                      }
                    >
                      {tx.amount >= 0 ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>

                    <td>{tx.category}</td>

                    <td>
                      <span
                        className={`status ${tx.status
                          .toLowerCase()
                          .replace(/\s/g, "-")}`}
                      >
                        {tx.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setInspectTx(tx);
                          setEditCategory(tx.category);
                        }}
                      >
                        {tx.action}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Inspect / Reconcile Modal */}
      {inspectTx && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Transaction Details ({inspectTx.id})</h3>
            <p>
              <strong>Date:</strong> {inspectTx.dateFormatted}
            </p>
            <p>
              <strong>Description:</strong> {inspectTx.description}
            </p>
            <p>
              <strong>Bank Account:</strong> {inspectTx.bankAccountLabel}
            </p>
            <p>
              <strong>Amount:</strong>{" "}
              {inspectTx.amount >= 0 ? "+" : "-"}
              {formatCurrency(inspectTx.amount)}
            </p>

            <label className="modal-label">Account Category</label>
            <select
              className="modal-select"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            >
              <option value="Accounts Receivable">Accounts Receivable</option>
              <option value="Accounts Payable">Accounts Payable</option>
              <option value="Operating Expense">Operating Expense</option>
              <option value="Payroll Expense">Payroll Expense</option>
              <option value="Other Cash Activity">Other Cash Activity</option>
            </select>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setInspectTx(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setCustomCategories((prev) => ({
                    ...prev,
                    [inspectTx.id]: editCategory,
                  }));
                  setReconciledIds((prev) =>
                    Array.from(new Set([...prev, inspectTx.id]))
                  );
                  setInspectTx(null);
                }}
              >
                Save &amp; Reconcile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
