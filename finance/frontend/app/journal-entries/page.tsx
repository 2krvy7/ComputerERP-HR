"use client";

import { useEffect, useState } from "react";
import "./journal-entries.css";

interface JournalEntry {
  id: string | number;
  entryNumber?: string;
  journalDate: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
}

export default function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEntries() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/journal");
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        setEntries(data);
      } catch (err: any) {
        setError(err.message || "Failed to load journal entries");
      } finally {
        setLoading(false);
      }
    }
    fetchEntries();
  }, []);

  // Format helpers
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

  // Search filter
  const filteredEntries = entries.filter((entry) => {
    const label = (entry.entryNumber || String(entry.id)).toLowerCase();
    const desc = (entry.description || "").toLowerCase();
    return label.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
  });

  // Dynamic stats
   const [currentPeriod, setCurrentPeriod] = useState<{ month: number; year: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentPeriod({ month: now.getMonth(), year: now.getFullYear() });
  }, []);

  const entriesThisMonth = currentPeriod
    ? entries.filter((e) => {
        const d = new Date(e.journalDate);
        return d.getMonth() === currentPeriod.month && d.getFullYear() === currentPeriod.year;
      }).length
    : 0;

  const postedCount = entries.filter((e) => e.status?.toLowerCase() === "posted").length;
  const awaitingCount = entries.filter((e) => e.status?.toLowerCase() === "approved" || e.status?.toLowerCase() === "pending").length;
  const draftCount = entries.filter((e) => e.status?.toLowerCase() === "draft").length;

  return (
    <div className="journal-page">
      <div className="page-header">
        <div>
          <h1>Journal Entries</h1>
          <p>Review, approve and post balanced entries.</p>
        </div>

        <button className="new-entry-btn">New Entry</button>
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
          placeholder="Search entry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button>All Sources</button>
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
                  <tr key={entry.id}>
                    <td>{entry.entryNumber || `JE-${String(entry.id).padStart(4, "0")}`}</td>
                    <td>{formatDate(entry.journalDate)}</td>
                    <td>{entry.description}</td>
                    <td>{formatCurrency(entry.totalDebit)}</td>
                    <td>{formatCurrency(entry.totalCredit)}</td>
                    <td>
                      <span className={`status ${(entry.status || "draft").toLowerCase()}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <button className="view-btn">View Entry</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}