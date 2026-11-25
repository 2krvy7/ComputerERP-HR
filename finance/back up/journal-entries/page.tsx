"use client";

import { useEffect, useMemo, useState } from "react";
import "./journal-entries.css";

interface JournalLine {
  lineID?: number;
  accountID?: number | string;
  accountCode?: string;
  accountName?: string;
  debit: number | string;
  credit: number | string;
}

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

  // View Entry Details Modal
  const [viewingEntry, setViewingEntry] = useState<any | null>(null);

  // New Journal Entry Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { accountID: "", debit: "", credit: "" },
    { accountID: "", debit: "", credit: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [jRes, coaRes] = await Promise.all([
        // FETCH 1: GET http://127.0.0
        // Backend File: finance/backend/routers/journal.py -> get_journal_entries()
        // Database Tables: Reads "JournalEntry" joined with "JournalEntryLine" and "ChartOfAccounts"
        // Purpose: Loads all posted journal entries, debit/credit totals, and line details
        fetch("http://127.0.0.1:8000/api/journal"),

        // FETCH 2: GET http://127.0.0
        // Backend File: finance/backend/routers/coa.py -> get_accounts()
        // Database Table: Reads "ChartOfAccounts"
        // Purpose: Populates account dropdowns inside the New Journal Entry modal
        fetch("http://127.0.0.1:8000/api/coa"),
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

  useEffect(() => {
    const now = new Date();
    setCurrentPeriod({ month: now.getMonth(), year: now.getFullYear() });
    setNewDate(now.toISOString().split("T")[0]);
    fetchAll();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount || 0));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Normalize PostgreSQL & API fields
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

  const availableSources = useMemo(
    () => Array.from(new Set(normalizedEntries.map((e) => e.sourceLabel))),
    [normalizedEntries]
  );

  const filteredEntries = useMemo(() => {
    return normalizedEntries.filter((entry) => {
      if (sourceFilter !== "ALL" && entry.sourceLabel !== sourceFilter) {
        return false;
      }
      const q = search.toLowerCase();
      return (
        entry.entryCode.toLowerCase().includes(q) ||
        (entry.description || "").toLowerCase().includes(q) ||
        entry.sourceLabel.toLowerCase().includes(q)
      );
    });
  }, [normalizedEntries, search, sourceFilter]);

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

  // New Entry Line Helpers
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

  function updateLine(index: number, field: keyof JournalLine, value: string) {
    setNewLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setNewLines((prev) => [...prev, { accountID: "", debit: "", credit: "" }]);
  }

  function removeLine(index: number) {
    if (newLines.length <= 2) return;
    setNewLines((prev) => prev.filter((_, i) => i !== index));
  }

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
      const res = await fetch("http://127.0.0.1:8000/api/journal", {
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
      <div className="page-header">
        <div>
          <h1>Journal Entries</h1>
          <p>Review, approve and post balanced entries.</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={fetchAll}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="new-entry-btn"
            onClick={() => setShowNewModal(true)}
            style={{ cursor: "pointer" }}
          >
            New Entry
          </button>
        </div>
      </div>

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

      <div className="toolbar">
        <input
          placeholder="Search entry code, description, or source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (availableSources.length === 0) return;
            const order = ["ALL", ...availableSources];
            const nextIdx = (order.indexOf(sourceFilter) + 1) % order.length;
            setSourceFilter(order[nextIdx]);
          }}
        >
          {sourceFilter === "ALL" ? "All Sources" : `Source: ${sourceFilter}`}
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>Entry Register</h2>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading journal entries...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
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
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No journal entries found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.normalizedId}>
                    <td>
                      <strong>{entry.entryCode}</strong>
                    </td>
                    <td>{formatDate(entry.journalDate)}</td>
                    <td>{entry.description}</td>
                    <td>{formatCurrency(entry.totalDebit)}</td>
                    <td>{formatCurrency(entry.totalCredit)}</td>
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
                        style={{ cursor: "pointer" }}
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

      {/* 1. View Journal Entry Modal */}
      {viewingEntry && (
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
              maxHeight: "82vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {viewingEntry.entryCode} — {viewingEntry.sourceLabel}
            </h3>
            <p style={{ margin: 0, color: "#4b5563", fontSize: "0.9rem" }}>
              <strong>Date:</strong> {formatDate(viewingEntry.journalDate)} ·{" "}
              <strong>Status:</strong> {viewingEntry.statusLabel}
            </p>
            <p style={{ margin: 0, fontWeight: 500 }}>
              {viewingEntry.description}
            </p>

            <table style={{ marginTop: "0.5rem" }}>
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
                    <td colSpan={3} style={{ textAlign: "center", padding: "0.75rem" }}>
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
                <tr style={{ fontWeight: 700, borderTop: "2px solid #e5e7eb" }}>
                  <td>Total</td>
                  <td>{formatCurrency(viewingEntry.totalDebit)}</td>
                  <td>{formatCurrency(viewingEntry.totalCredit)}</td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 2. New Journal Entry Modal */}
      {showNewModal && (
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
            onSubmit={handleCreateEntry}
            style={{
              backgroundColor: "#ffffff",
              padding: "1.5rem",
              borderRadius: "10px",
              width: "620px",
              maxHeight: "88vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3 style={{ margin: 0 }}>New Manual Journal Entry</h3>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label>Date *</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label>Reference No.</label>
                <input
                  type="text"
                  placeholder={`e.g. JE-${String(entries.length + 1).padStart(4, "0")}`}
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label>Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Initial Owner Capital Investment"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            {/* Debit / Credit Lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Journal Lines (Debits must equal Credits)</strong>
                <button
                  type="button"
                  onClick={addLine}
                  style={{
                    padding: "0.3rem 0.7rem",
                    borderRadius: "6px",
                    border: "1px solid #2563eb",
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                  }}
                >
                  + Add Line
                </button>
              </div>

              {newLines.map((line, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    required
                    value={line.accountID}
                    onChange={(e) => updateLine(idx, "accountID", e.target.value)}
                    style={{ flex: 2, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  >
                    <option value="">-- Select Account --</option>
                    {coaAccounts.map((acc) => (
                      <option key={acc.accountID} value={acc.accountID}>
                        {acc.accountCode} - {acc.accountName}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit}
                    onChange={(e) => updateLine(idx, "debit", e.target.value)}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit}
                    onChange={(e) => updateLine(idx, "credit", e.target.value)}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
                  />

                  {newLines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      style={{
                        padding: "0.45rem 0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Balance Status Bar */}
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                backgroundColor: isModalBalanced ? "#ecfdf5" : "#fef2f2",
                color: isModalBalanced ? "#065f46" : "#991b1b",
                fontSize: "0.88rem",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
              }}
            >
              <span>Total Debit: {formatCurrency(modalDebitTotal)}</span>
              <span>Total Credit: {formatCurrency(modalCreditTotal)}</span>
              <span>
                {isModalBalanced ? "✅ Balanced" : "⚠️ Out of Balance"}
              </span>
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
                onClick={() => setShowNewModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="new-entry-btn"
                disabled={submitting || !isModalBalanced}
                style={{
                  opacity: submitting || !isModalBalanced ? 0.6 : 1,
                  cursor: submitting || !isModalBalanced ? "not-allowed" : "pointer",
                }}
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
