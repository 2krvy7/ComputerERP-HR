"use client";

import { useEffect, useMemo, useState } from "react";
import "./ar-aging.css";

type AgingItem = {
  id: number;
  partyName: string;
  dueDate: string;
  balance: number;
  daysOverdue: number;
  bucket: string;
};

type AgingSummary = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
};

type CustomerRow = {
  customer: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  invoiceCount: number;
};

export default function ARAgingPage() {
  const [items, setItems] = useState<AgingItem[]>([]);
  const [summary, setSummary] = useState<AgingSummary>({
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("ALL");
  const [todayLabel, setTodayLabel] = useState("");

  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");


  async function fetchARAging() {
    setLoading(true);
    setError(null);
    try {
      // FETCH: GET http://127.0.0
      // Backend File: finance/backend/routers/reports.py -> ar_aging()
      // Database Tables: Reads unpaid "ARInvoice" rows joined with Team 4 "Customer" and ages by CURRENT_DATE - dueDate
      const res = await fetch(`${API_URL}/api/reports/ar-aging`);
      if (!res.ok) throw new Error(`AR Aging API error: ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Failed to load AR Aging report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
    fetchARAging();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  const formatCell = (val: number) => (val > 0 ? formatCurrency(val) : "-");

  const customerRows = useMemo<CustomerRow[]>(() => {
    const grouped: Record<string, CustomerRow> = {};

    items.forEach((item) => {
      const rawName = String(item.partyName ?? "").trim();
      const name =
        rawName && !/^\d+$/.test(rawName)
          ? rawName
          : rawName
          ? `Customer #${rawName}`
          : "Walk-in Customer";

      if (!grouped[name]) {
        grouped[name] = {
          customer: name,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
          total: 0,
          invoiceCount: 0,
        };
      }

      const bal = Number(item.balance || 0);
      if (item.bucket === "Current") grouped[name].current += bal;
      else if (item.bucket === "1-30 Days") grouped[name].days1to30 += bal;
      else if (item.bucket === "31-60 Days") grouped[name].days31to60 += bal;
      else if (item.bucket === "61-90 Days") grouped[name].days61to90 += bal;
      else grouped[name].days90plus += bal;

      grouped[name].total += bal;
      grouped[name].invoiceCount += 1;
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [items]);

  const filteredRows = useMemo(() => {
    if (selectedCustomer === "ALL") return customerRows;
    return customerRows.filter((r) => r.customer === selectedCustomer);
  }, [customerRows, selectedCustomer]);

  const metrics = useMemo(() => {
    const overdueTotal =
      summary.days1to30 +
      summary.days31to60 +
      summary.days61to90 +
      summary.days90plus;
    const over60Total = summary.days61to90 + summary.days90plus;

    const currentPct =
      summary.total > 0
        ? ((summary.current / summary.total) * 100).toFixed(1)
        : "0.0";
    const overduePct =
      summary.total > 0
        ? ((overdueTotal / summary.total) * 100).toFixed(1)
        : "0.0";

    const over60Customers = customerRows
      .filter((r) => r.days61to90 + r.days90plus > 0)
      .map((r) => r.customer);

    return {
      overdueTotal,
      over60Total,
      currentPct,
      overduePct,
      over60Note:
        over60Customers.length > 0
          ? over60Customers.slice(0, 2).join(" & ")
          : "No customers over 60 days",
    };
  }, [summary, customerRows]);

  const barWidths = useMemo(() => {
    const t = summary.total || 1;
    return {
      current: `${(summary.current / t) * 100}%`,
      days30: `${(summary.days1to30 / t) * 100}%`,
      days60: `${(summary.days31to60 / t) * 100}%`,
      days90: `${(summary.days61to90 / t) * 100}%`,
      days120: `${(summary.days90plus / t) * 100}%`,
    };
  }, [summary]);

  function handleExportCSV() {
    const headers = [
      "Customer",
      "Current",
      "1-30 Days",
      "31-60 Days",
      "61-90 Days",
      "90+ Days",
      "Total",
    ];
    const rows = filteredRows.map((r) => [
      `"${r.customer}"`,
      r.current.toFixed(2),
      r.days1to30.toFixed(2),
      r.days31to60.toFixed(2),
      r.days61to90.toFixed(2),
      r.days90plus.toFixed(2),
      r.total.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ar-aging-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ar-aging-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AR Aging</h1>
          <p>
            Understand overdue customer balances and focus your collection
            efforts where they matter.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            Export
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print Report
          </button>
        </div>
      </div>

      
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Total Receivables</span>
          <h2>{loading ? "..." : formatCurrency(summary.total)}</h2>
          <small>
            {items.length} {items.length === 1 ? "invoice" : "invoices"} •{" "}
            {customerRows.length}{" "}
            {customerRows.length === 1 ? "customer" : "customers"}
          </small>
        </div>

        <div className="summary-card">
          <span>Current</span>
          <h2>{loading ? "..." : formatCurrency(summary.current)}</h2>
          <small>{metrics.currentPct}% of outstanding receivables</small>
        </div>

        <div className="summary-card">
          <span>Overdue</span>
          <h2>{loading ? "..." : formatCurrency(metrics.overdueTotal)}</h2>
          <small>{metrics.overduePct}% of outstanding receivables</small>
        </div>

        <div className="summary-card">
          <span>Over 60 Days</span>
          <h2>{loading ? "..." : formatCurrency(metrics.over60Total)}</h2>
          <small>{metrics.over60Note}</small>
        </div>
      </div>

      {/* Balance by Age */}
      <div className="aging-section">
        <div className="section-header">
          <h3>Balance by Age</h3>
          <span>{todayLabel ? `As of ${todayLabel}` : "Current"}</span>
        </div>

        <div className="aging-bar">
          <div className="current" style={{ width: barWidths.current }}></div>
          <div className="days30" style={{ width: barWidths.days30 }}></div>
          <div className="days60" style={{ width: barWidths.days60 }}></div>
          <div className="days90" style={{ width: barWidths.days90 }}></div>
          <div className="days120" style={{ width: barWidths.days120 }}></div>
        </div>

        <div className="aging-legend">
          <div>
            <span className="dot blue"></span>
            Current
            <strong>{formatCurrency(summary.current)}</strong>
          </div>

          <div>
            <span className="dot light-blue"></span>
            1-30 Days
            <strong>{formatCurrency(summary.days1to30)}</strong>
          </div>

          <div>
            <span className="dot sky"></span>
            31-60 Days
            <strong>{formatCurrency(summary.days31to60)}</strong>
          </div>

          <div>
            <span className="dot orange"></span>
            61-90 Days
            <strong>{formatCurrency(summary.days61to90)}</strong>
          </div>

          <div>
            <span className="dot red"></span>
            90+ Days
            <strong>{formatCurrency(summary.days90plus)}</strong>
          </div>
        </div>
      </div>

      {/* Receivables Table */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h3>Receivables Aging by Customer</h3>
            <p>
              Outstanding customer balances{" "}
              {todayLabel ? `as of ${todayLabel}` : ""}
            </p>
          </div>

          <button className="btn btn-secondary" onClick={fetchARAging}>
            Refresh Report
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading AR Aging data...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Current</th>
                <th>1-30 Days</th>
                <th>31-60 Days</th>
                <th>61-90 Days</th>
                <th>90+ Days</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No unpaid customer invoices found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.customer}>
                    <td>{row.customer}</td>
                    <td>{formatCell(row.current)}</td>
                    <td>{formatCell(row.days1to30)}</td>
                    <td>{formatCell(row.days31to60)}</td>
                    <td>{formatCell(row.days61to90)}</td>
                    <td>{formatCell(row.days90plus)}</td>
                    <td>{formatCurrency(row.total)}</td>
                  </tr>
                ))
              )}

              <tr className="total-row">
                <td>Total Receivables</td>
                <td>{formatCurrency(summary.current)}</td>
                <td>{formatCurrency(summary.days1to30)}</td>
                <td>{formatCurrency(summary.days31to60)}</td>
                <td>{formatCurrency(summary.days61to90)}</td>
                <td>{formatCurrency(summary.days90plus)}</td>
                <td>{formatCurrency(summary.total)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="table-footer">
          <p>
            {customerRows.length}{" "}
            {customerRows.length === 1 ? "customer" : "customers"} ·{" "}
            {items.length} unpaid{" "}
            {items.length === 1 ? "invoice" : "invoices"} · Total agrees with
            the Accounts Receivable balance in the ledger
          </p>
        </div>
      </div>

      {/* Insights */}
      <div className="notes-section">
        <p>
          {metrics.over60Total > 0
            ? `Priority follow-up: ${formatCurrency(metrics.over60Total)} is overdue by more than 60 days (${metrics.over60Note}).`
            : "Healthy receivables aging: no customer balances are overdue past 60 days."}
        </p>

        <p>
          Total overdue balance stands at {formatCurrency(metrics.overdueTotal)}{" "}
          ({metrics.overduePct}% of total receivables).
        </p>
      </div>
    </div>
  );
}