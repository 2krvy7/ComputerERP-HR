"use client";

import { useEffect, useMemo, useState } from "react";
import "./journal-entries.css";

// Individual debit/credit line inside a journal entry
interface JournalLine {
  lineID?: number;
  accountID?: number | string;
  accountCode?: string;
  accountName?: string;
  debit: number | string;
  credit: number | string;
}

// Journal entry header returned from backend API
interface JournalEntry {
  id?: string | number;
  journalID?: string | number;
  entryNumber?: string;
  referenceNo?: string;
  journalDate: string;
  sourceModule?: string;
  description: string;
  totalDebit?: number;
  totalCredit?: number;
  status?: string;
  lines?: JournalLine[];
}

export default function JournalEntries() {
  // Core directory & filter states
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPeriod, setCurrentPeriod] = useState<{
    month: number;
    year: number;
  } | null>(null);

  // View Entry Details modal state
  const [viewingEntry, setViewingEntry] = useState<any | null>(null);

  // New Manual Journal Entry modal states
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { accountID: "", debit: "", credit: "" },
    { accountID: "", debit: "", credit: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

 



  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

  // Load journal entries and Chart of Accounts options from FastAPI backend
  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [jRes, coaRes] = await Promise.all([
        // FETCH 1: GET http://127.0.0
        // Backend File: finance/backend/routers/journal.py -> get_journal_entries()
        // Database Tables: Reads "JournalEntry" joined with "JournalEntryLine" and "ChartOfAccounts"
        // Purpose: Loads all posted journal entries, debit/credit totals, and line details
        fetch(`${API_URL}/api/journal`),

        // FETCH 2: GET http://127.0.0
        // Backend File: finance/backend/routers/coa.py -> get_accounts()
        // Database Table: Reads "ChartOfAccounts"
        // Purpose: Populates account dropdowns inside the New Journal Entry modal
        fetch(`${API_URL}/api/journal`),
      ]);

      if (!jRes.ok) throw new Error(`Server error: ${jRes.status}`);
      const jData = await jRes.json();
      setEntries(Array.isArray(jData) ? jData : []);

      if (coaRes.ok) {
        const cData = await coaRes.json();
        setCoaAccounts(Array.isArray(cData) ? cData : []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }

  // Initialize current period and default modal date on mount
  useEffect(() => {
    const now = new Date();
    setCurrentPeriod({ month: now.getMonth(), year: now.getFullYear() });
    setNewDate(now.toISOString().split("T")[0]);
    fetchAll();
  }, []);

  // Format numeric currency values
    const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val || 0));


  // Format ISO dates into readable short labels
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Condenses long auto-generated descriptions into concise identifiers for the table
const formatShortDescription = (rawDesc: string) => {
  if (!rawDesc) return "-";
  // Strip verbose "— Net Sales: ..., Output VAT: ..." tail on AR Collections
      let short = rawDesc.split("—")[0].trim();

  // Strip "(BDO Corporate Checking -> BPI Payroll)" transfer note
  short = short.replace(/\s*\(BDO Corporate Checking\s*->\s*BPI Payroll\)/i, "");
  // Shorten common verbose prefixes
  short = short
    .replace(/^Supplier payment for /i, "")
    .replace(/^Customer collection for /i, "")
    .replace(/^Approved Production Batch /i, "Production Batch ")
    .replace(/^Operating Expense /i, "Expense ");
  return short;
};

  // Normalize PostgreSQL fields and compute debit/credit totals per entry
  const normalizedEntries = useMemo(() => {
    return entries.map((entry, idx) => {
      const rawId = entry.journalID ?? entry.id ?? idx + 1;
      const entryCode =
        entry.referenceNo ||
        entry.entryNumber ||
        `JE-${String(rawId).padStart(4, "0")}`;

      const lines = Array.isArray(entry.lines) ? entry.lines : [];
      const lineDebitSum = lines.reduce(
        (s, l) => s + Number(l.debit || 0),
        0
      );
      const lineCreditSum = lines.reduce(
        (s, l) => s + Number(l.credit || 0),
        0
      );

      const totalDebit =
        Number(entry.totalDebit ?? 0) > 0
          ? Number(entry.totalDebit)
          : lineDebitSum;
      const totalCredit =
        Number(entry.totalCredit ?? 0) > 0
          ? Number(entry.totalCredit)
          : lineCreditSum;

      return {
        ...entry,
        normalizedId: rawId,
        entryCode,
        sourceLabel: entry.sourceModule || "Manual",
        totalDebit,
        totalCredit,
        statusLabel: entry.status || "Posted",
        lines,
      };
    });
  }, [entries]);

  // Extract unique source modules for the Source dropdown filter
  const availableSources = useMemo(
    () => Array.from(new Set(normalizedEntries.map((e) => e.sourceLabel))),
    [normalizedEntries]
  );

    // Filter journal entries by source & search text (newest first)
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = normalizedEntries.filter((entry) => {
      if (sourceFilter !== "ALL" && entry.sourceLabel !== sourceFilter) {
        return false;
      }
      return (
        entry.entryCode.toLowerCase().includes(q) ||
        (entry.description || "").toLowerCase().includes(q) ||
        entry.sourceLabel.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const timeA = a.journalDate ? new Date(a.journalDate).getTime() : 0;
      const timeB = b.journalDate ? new Date(b.journalDate).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return Number(b.normalizedId || 0) - Number(a.normalizedId || 0);
    });
  }, [normalizedEntries, search, sourceFilter]);




    // Summary card counts
  const entriesThisMonth = currentPeriod
    ? normalizedEntries.filter((e) => {
        const d = new Date(e.journalDate);
        return (
          d.getMonth() === currentPeriod.month &&
          d.getFullYear() === currentPeriod.year
        );
      }).length
    : 0;

  const postedCount = normalizedEntries.filter(
    (e) => e.statusLabel.toLowerCase() === "posted"
  ).length;
  const awaitingCount = normalizedEntries.filter((e) =>
    ["approved", "pending"].includes(e.statusLabel.toLowerCase())
  ).length;
  const draftCount = normalizedEntries.filter(
    (e) => e.statusLabel.toLowerCase() === "draft"
  ).length;

  // Live debit/credit balance validation inside New Entry modal
  const modalDebitTotal = newLines.reduce(
    (sum, l) => sum + Number(l.debit || 0),
    0
  );
  const modalCreditTotal = newLines.reduce(
    (sum, l) => sum + Number(l.credit || 0),
    0
  );
  const isModalBalanced =
    modalDebitTotal > 0 && Math.abs(modalDebitTotal - modalCreditTotal) < 0.01;

  // Update a specific field on a manual journal line
  function updateLine(index: number, field: keyof JournalLine, value: string) {
    setNewLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  // Add another debit/credit row to the modal
  function addLine() {
    setNewLines((prev) => [...prev, { accountID: "", debit: "", credit: "" }]);
  }

  // Remove an extra debit/credit row (minimum 2 lines required)
  function removeLine(index: number) {
    if (newLines.length <= 2) return;
    setNewLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Validate and submit a new balanced manual journal entry
  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newDesc.trim()) {
      alert("Please enter a date and description.");
      return;
    }
    if (!isModalBalanced) {
      alert("Total Debits must equal Total Credits and be greater than $0.00.");
      return;
    }

    const formattedLines = newLines
      .filter(
        (l) =>
          l.accountID !== "" &&
          (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0)
      )
      .map((l) => ({
        accountID: Number(l.accountID),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }));

    if (formattedLines.length < 2) {
      alert("Please select at least two valid accounts.");
      return;
    }

    setSubmitting(true);
    try {
      // FETCH 3: POST http://127.0.0
      // Backend File: finance/backend/routers/journal.py -> create_journal_entry()
      // Database Tables: Inserts balanced entry into "JournalEntry", "JournalEntryLine", and "GeneralLedger"
      // Purpose: Posts a new manual journal entry to the accounting ledger
      const res = await fetch(`${API_URL}/api/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalDate: newDate,
          referenceNo:
            newRef.trim() ||
            `JE-${String(entries.length + 1).padStart(4, "0")}`,
          sourceModule: "Manual",
          description: newDesc.trim(),
          lines: formattedLines,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to post journal entry");
      }

      setShowNewModal(false);
      setNewRef("");
      setNewDesc("");
      setNewLines([
        { accountID: "", debit: "", credit: "" },
        { accountID: "", debit: "", credit: "" },
      ]);
      await fetchAll();
    } catch (err: any) {
      alert(err.message || "Error creating journal entry");
    } finally {
      setSubmitting(false);
    }
  }


    return (
    <div className="journal-page">
      {/* Fixed Aligned Page Header */}
      <div className="page-header">
        <h1>Journal Entries</h1>

        <div className="header-actions">
          <button type="button" className="refresh-btn" onClick={fetchAll}>
            Refresh
          </button>
          <button
            type="button"
            className="new-entry-btn"
            onClick={() => setShowNewModal(true)}
          >
            New Entry
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Entries this month</h3>
          <span>{entriesThisMonth}</span>
        </div>

        <div className="stat-card">
          <h3>Posted entries</h3>
          <span>{postedCount}</span>
        </div>

        <div className="stat-card">
          <h3>Awaiting approval</h3>
          <span>{awaitingCount}</span>
        </div>

        <div className="stat-card">
          <h3>Draft entries</h3>
          <span>{draftCount}</span>
        </div>
      </div>

      {/* Search Bar & Interactive Source Dropdown Filter */}
             {/* Search Bar & Entry Source Dropdown */}
      <div className="toolbar">
        <input
          className="toolbar-search"
          placeholder="Search entry code, description, or source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="source-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter by entry source"
        >
          <option value="ALL">All Sources</option>
          {availableSources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      </div>


      {/* Entry Register Table (Left-aligned section header, centered columns) */}
      <div className="table-container">
        <div className="table-header">
          <h2>Entry Register</h2>
        </div>

        {loading ? (
          <p className="table-state-msg">Loading journal entries...</p>
        ) : error ? (
          <p className="table-state-msg error">Error: {error}</p>
        ) : (
          <table className="journal-table">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Date</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7}>No journal entries found.</td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.normalizedId}>
                    <td>
                      <strong>{entry.entryCode}</strong>
                    </td>
                    <td>{formatDate(entry.journalDate)}</td>
                    {/* ⬇️ REPLACE <td>{entry.description}</td> WITH THIS LINE (around line 405) ⬇️ */}
                    <td>{formatShortDescription(entry.description)}</td>
                    <td>{formatCurrency(entry.totalDebit)}</td>
                    <td>
                      <span
                        className={`status ${entry.statusLabel.toLowerCase()}`}
                      >
                        {entry.statusLabel}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="view-btn"
                        onClick={() => setViewingEntry(entry)}
                      >
                        View Entry
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 1. View Journal Entry Details Modal */}
      {viewingEntry && (
        <div className="je-modal-overlay">
          <div className="je-view-modal">
            <h3>
              {viewingEntry.entryCode} — {viewingEntry.sourceLabel}
            </h3>
            <p className="je-meta-text">
              <strong>Date:</strong> {formatDate(viewingEntry.journalDate)} ·{" "}
              <strong>Status:</strong> {viewingEntry.statusLabel}
            </p>
            <p className="je-desc-text">{viewingEntry.description}</p>

            <table className="je-lines-preview-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {viewingEntry.lines.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      No individual line items returned from backend.
                    </td>
                  </tr>
                ) : (
                  viewingEntry.lines.map((line: JournalLine, i: number) => (
                    <tr key={line.lineID ?? i}>
                      <td>
                        {line.accountCode ? `${line.accountCode} - ` : ""}
                        {line.accountName || `Account #${line.accountID}`}
                      </td>
                      <td>
                        {Number(line.debit) > 0
                          ? formatCurrency(Number(line.debit))
                          : "-"}
                      </td>
                      <td>
                        {Number(line.credit) > 0
                          ? formatCurrency(Number(line.credit))
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="je-total-row">
                  <td>Total</td>
                  <td>{formatCurrency(viewingEntry.totalDebit)}</td>
                  <td>{formatCurrency(viewingEntry.totalCredit)}</td>
                </tr>
              </tbody>
            </table>

            <div className="je-modal-footer">
              <button
                type="button"
                className="je-cancel-btn"
                onClick={() => setViewingEntry(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Expanded No-Scroll New Manual Journal Entry Modal */}
      {showNewModal && (
        <div className="je-modal-overlay">
          <form className="je-new-modal" onSubmit={handleCreateEntry}>
            <h3>New Manual Journal Entry</h3>

            <div className="je-form-grid">
              <div className="je-field-group">
                <label>Date *</label>
                <input
                  type="date"
                  required
                  className="je-input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>

              <div className="je-field-group">
                <label>Reference No.</label>
                <input
                  type="text"
                  className="je-input"
                  placeholder={`e.g. JE-${String(entries.length + 1).padStart(4, "0")}`}
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                />
              </div>

              <div className="je-field-group">
                <label>Description *</label>
                <input
                  type="text"
                  required
                  className="je-input"
                  placeholder="e.g. Initial Owner Capital Investment"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
            </div>

            {/* Debit & Credit Account Lines */}
            <div className="je-lines-box">
              <div className="je-lines-header">
                <strong>Journal Lines (Debits must equal Credits)</strong>
                <button
                  type="button"
                  className="je-add-line-btn"
                  onClick={addLine}
                >
                  + Add Line
                </button>
              </div>

              {newLines.map((line, idx) => (
                <div key={idx} className="je-line-row">
                  <select
                    required
                    className="je-select"
                    value={line.accountID}
                    onChange={(e) =>
                      updateLine(idx, "accountID", e.target.value)
                    }
                  >
                    <option value="">-- Select Account --</option>
                    {Array.from(
                      new Map(
                        coaAccounts.map((acc) => [String(acc.accountID ?? acc.accountCode), acc])
                      ).values()
                    ).map((acc, aIdx) => {
                      const val = String(acc.accountID ?? acc.accountCode);
                      return (
                        <option key={`${val}-${aIdx}`} value={val}>
                          {acc.accountCode} - {acc.accountName}
                        </option>
                      );
                    })}

                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="je-input"
                    placeholder="Debit"
                    value={line.debit}
                    onChange={(e) => updateLine(idx, "debit", e.target.value)}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="je-input"
                    placeholder="Credit"
                    value={line.credit}
                    onChange={(e) => updateLine(idx, "credit", e.target.value)}
                  />

                  {newLines.length > 2 && (
                    <button
                      type="button"
                      className="je-remove-line-btn"
                      onClick={() => removeLine(idx)}
                      title="Remove line"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Live Balance Status Strip */}
            <div
              className={`je-balance-bar ${
                isModalBalanced ? "balanced" : "unbalanced"
              }`}
            >
              <span>Total Debit: {formatCurrency(modalDebitTotal)}</span>
              <span>Total Credit: {formatCurrency(modalCreditTotal)}</span>
              <span>
                {isModalBalanced ? "✅ Balanced" : "⚠️ Out of Balance"}
              </span>
            </div>

            <div className="je-modal-footer">
              <button
                type="button"
                className="je-cancel-btn"
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="new-entry-btn"
                disabled={submitting || !isModalBalanced}
              >
                {submitting ? "Posting..." : "Post Journal Entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
