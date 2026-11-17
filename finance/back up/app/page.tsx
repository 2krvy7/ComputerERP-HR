"use client";

import { useEffect, useState } from "react";
import "./globals.css";

interface DashboardData {
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    cashBalance: number;
    netIncome: number;
  };
  recentEntries: any[];
  ap: {
    outstandingInvoices: number;
    totalDue: number;
    dueThisWeek: number;
  };
  ar: {
    outstandingInvoices: number;
    totalReceivable: number;
    pastDue: number;
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/dashboard/");
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const formatCurrency = (val?: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toISOString().split("T")[0];
  };

  return (
    <div className="dashboard">
      <h1 className="page-title">Finance Dashboard</h1>

      {error && (
        <p style={{ color: "red", marginBottom: "1rem" }}>
          Backend Connection Error: {error}
        </p>
      )}

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="summary-card">
          <h3>Total Assets</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.totalAssets)}</p>
        </div>

        <div className="summary-card">
          <h3>Total Liabilities</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.totalLiabilities)}</p>
        </div>

        <div className="summary-card">
          <h3>Cash Balance</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.cashBalance)}</p>
        </div>

        <div className="summary-card">
          <h3>Net Income</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.netIncome)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Revenue vs Expenses</h2>
          <div className="chart-placeholder">
            Chart goes here
          </div>
        </div>

        <div className="panel">
          <h2>Cash Flow</h2>
          <div className="chart-placeholder">
            Chart goes here
          </div>
        </div>
      </div>

      {/* Journal Entries */}
      <div className="panel">
        <h2>Recent Journal Entries</h2>

        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Loading recent entries...</td>
              </tr>
            ) : !data?.recentEntries || data.recentEntries.length === 0 ? (
              <tr>
                <td colSpan={4}>No journal entries recorded yet.</td>
              </tr>
            ) : (
              data.recentEntries.map((entry, idx) => (
                <tr key={entry.id ?? entry.entryID ?? idx}>
                  <td>{formatDate(entry.journalDate ?? entry.date ?? entry.createdAt)}</td>
                  <td>{entry.entryNumber ?? entry.reference ?? `JE-${entry.id ?? entry.entryID ?? idx + 1}`}</td>
                  <td>{entry.description ?? "-"}</td>
                  <td>{formatCurrency(entry.totalDebit ?? entry.amount ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* AP/AR */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Accounts Payable</h2>

          <ul>
            <li>Outstanding Invoices: {loading ? "..." : data?.ap.outstandingInvoices ?? 0}</li>
            <li>Total Due: {loading ? "..." : formatCurrency(data?.ap.totalDue)}</li>
            <li>Due This Week: {loading ? "..." : formatCurrency(data?.ap.dueThisWeek)}</li>
          </ul>
        </div>

        <div className="panel">
          <h2>Accounts Receivable</h2>

          <ul>
            <li>Outstanding Invoices: {loading ? "..." : data?.ar.outstandingInvoices ?? 0}</li>
            <li>Total Receivable: {loading ? "..." : formatCurrency(data?.ar.totalReceivable)}</li>
            <li>Past Due: {loading ? "..." : formatCurrency(data?.ar.pastDue)}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}