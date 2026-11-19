"use client";

import { useEffect, useMemo, useState } from "react";
import "./ap-aging.css";

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

type SupplierRow = {
  supplier: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
  billCount: number;
};

export default function APAgingPage() {
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
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");

  async function fetchAPAging() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/reports/ap-aging");
      if (!res.ok) throw new Error(`AP Aging API error: ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Failed to load AP Aging report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAPAging();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const formatCell = (val: number) => (val > 0 ? formatCurrency(val) : "-");

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  // Group individual open bills by Supplier across the 5 aging buckets
  const supplierRows = useMemo<SupplierRow[]>(() => {
    const grouped: Record<string, SupplierRow> = {};

    items.forEach((item) => {
      const name = item.partyName || "Unknown Supplier";
      if (!grouped[name]) {
        grouped[name] = {
          supplier: name,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
          total: 0,
          billCount: 0,
        };
      }

      const bal = Number(item.balance || 0);
      if (item.bucket === "Current") grouped[name].current += bal;
      else if (item.bucket === "1-30 Days") grouped[name].days1to30 += bal;
      else if (item.bucket === "31-60 Days") grouped[name].days31to60 += bal;
      else if (item.bucket === "61-90 Days") grouped[name].days61to90 += bal;
      else grouped[name].days90plus += bal;

      grouped[name].total += bal;
      grouped[name].billCount += 1;
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [items]);

  const filteredRows = useMemo(() => {
    if (selectedSupplier === "ALL") return supplierRows;
    return supplierRows.filter((r) => r.supplier === selectedSupplier);
  }, [supplierRows, selectedSupplier]);

  const metrics = useMemo(() => {
    const overdueTotal =
      summary.days1to30 +
      summary.days31to60 +
      summary.days61to90 +
      summary.days90plus;
    const over60Total = summary.days61to90 + summary.days90plus;

    const currentPct =
      summary.total > 0 ? Math.round((summary.current / summary.total) * 100) : 0;
    const overduePct =
      summary.total > 0 ? Math.round((overdueTotal / summary.total) * 100) : 0;

    const over60Suppliers = supplierRows
      .filter((r) => r.days61to90 + r.days90plus > 0)
      .map((r) => r.supplier);

    return {
      overdueTotal,
      over60Total,
      currentPct,
      overduePct,
      over60Note:
        over60Suppliers.length > 0
          ? over60Suppliers.slice(0, 2).join(" and ")
          : "No suppliers over 60 days",
    };
  }, [summary, supplierRows]);

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
      "Supplier",
      "Current",
      "1-30 Days",
      "31-60 Days",
      "61-90 Days",
      "90+ Days",
      "Total",
    ];
    const rows = filteredRows.map((r) => [
      `"${r.supplier}"`,
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
    link.download = `ap-aging-${new Date().toISOString().split("T")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ap-aging-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AP Aging</h1>
          <p>
            Know what you owe and prioritize supplier payments by how long
            they&apos;re overdue.
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

      {/* Filters */}
      <div className="filters">
        <button onClick={fetchAPAging}>As of {todayLabel}</button>
        <button>Age by due date</button>
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            background: "#fff",
          }}
        >
          <option value="ALL">All suppliers ({supplierRows.length})</option>
          {supplierRows.map((r) => (
            <option key={r.supplier} value={r.supplier}>
              {r.supplier}
            </option>
          ))}
        </select>
        <button>USD</button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Total Payables</span>
          <h2>{loading ? "..." : formatCurrency(summary.total)}</h2>
          <small>
            {items.length} {items.length === 1 ? "bill" : "bills"} •{" "}
            {supplierRows.length}{" "}
            {supplierRows.length === 1 ? "supplier" : "suppliers"}
          </small>
        </div>

        <div className="summary-card">
          <span>Current</span>
          <h2>{loading ? "..." : formatCurrency(summary.current)}</h2>
          <small>{metrics.currentPct}% of outstanding payables</small>
        </div>

        <div className="summary-card">
          <span>Overdue</span>
          <h2>{loading ? "..." : formatCurrency(metrics.overdueTotal)}</h2>
          <small>{metrics.overduePct}% of outstanding payables</small>
        </div>

        <div className="summary-card">
          <span>Over 60 Days</span>
          <h2>{loading ? "..." : formatCurrency(metrics.over60Total)}</h2>
          <small>{metrics.over60Note}</small>
        </div>
      </div>

      {/* Aging Bar */}
      <div className="aging-section">
        <div className="section-header">
          <h3>Balance by Age</h3>
          <span>As of {todayLabel}</span>
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

      {/* Table */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h3>Payables Aging by Supplier</h3>
            <p>Outstanding supplier balances as of {todayLabel}</p>
          </div>

          <button className="btn btn-secondary" onClick={fetchAPAging}>
            Refresh Report
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading AP Aging data...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
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
                    No unpaid supplier bills found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.supplier}>
                    <td>{row.supplier}</td>
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
                <td>Total Payables</td>
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
      </div>
    </div>
  );
}