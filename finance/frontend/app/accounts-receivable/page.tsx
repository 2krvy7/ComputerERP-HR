"use client";

import { useEffect, useMemo, useState } from "react";
import "./arreceivable.css";

export default function ARInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receiptStats, setReceiptStats] = useState({
    totalCollected: 0,
    receiptCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  // Tabs & Filters (Starts on "ALL" = All Invoices)
  const [activeTab, setActiveTab] = useState<
    "ALL" | "Unpaid" | "Overdue" | "Draft" | "Paid"
  >("ALL");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");

  // View Invoice Modal
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [invRes, recRes] = await Promise.all([
        // FETCH 1: GET ${API_URL}/api/arinvoices
        // Backend File: finance/backend/routers/arinvoices.py -> get_ar_invoices()
        // Database Tables: Auto-syncs Team 4 Sales Invoices & ARReceipts, then reads "ARInvoice" joined with "Customer"
        // Purpose: Loads all customer receivables for the AR Invoices table and KPI cards
        fetch(`${API_URL}/api/arinvoices`),

        // FETCH 2: GET ${API_URL}/api/arinvoices/receipts-summary
        // Backend File: finance/backend/routers/arinvoices.py -> get_receipts_summary()
        // Database Table: Aggregates "ARReceipt" (totalCollected and receiptCount)
        // Purpose: Displays total collections received on the AR Invoices summary card
        fetch(`${API_URL}/api/arinvoices/receipts-summary`),
      ]);

      if (!invRes.ok) throw new Error(`AR API error: ${invRes.status}`);
      const invJson = await invRes.json();
      setInvoices(Array.isArray(invJson) ? invJson : []);

      if (recRes.ok) {
        setReceiptStats(await recRes.json());
      }
    } catch (err: any) {
      setError(err.message || "Failed to load AR invoices");
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
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  // Normalize customer invoices & sort newest invoice on top (rawId DESC)
  const normalizedInvoices = useMemo(() => {
    return invoices
      .map((row, idx) => {
        const rawId = Number(
          row.arInvoiceID ?? row.arinvoiceid ?? row.id ?? idx + 1
        );
        const displayId = `INV-${String(rawId).padStart(4, "0")}`;
        const custId = row.customerID ?? row.customerid ?? "";
        const customer =
          row.customer_name ??
          row.customerName ??
          (custId ? `Customer #${custId}` : "Walk-in Customer");
        const salesRef = row.salesInvoiceID ?? row.salesinvoiceid;
        const description = salesRef
          ? `Sales Invoice #${salesRef}`
          : "Customer Receivable";
        const dueDateRaw = row.dueDate ?? row.duedate ?? "";
        const isoDue = dueDateRaw
          ? new Date(dueDateRaw).toISOString().split("T")[0]
          : "";
        const amount = Number(row.amount ?? 0);
        const balance = Number(
          row.remainingBalance ?? row.remainingbalance ?? amount
        );

        let status = row.status ?? "Sent";
        if (balance <= 0 || status.toLowerCase() === "paid") {
          status = "Paid";
        } else if (
          status.toLowerCase() !== "draft" &&
          todayStr &&
          isoDue &&
          isoDue < todayStr
        ) {
          status = "Overdue";
        }

        return {
          rawId,
          displayId,
          customer,
          description,
          isoDue,
          dueDateFormatted: formatDate(dueDateRaw),
          amount,
          balance,
          status,
        };
      })
      .sort((a, b) => b.rawId - a.rawId);
  }, [invoices, todayStr]);

  const stats = useMemo(() => {
    const unpaid = normalizedInvoices.filter(
      (i) => i.status !== "Paid" && i.status !== "Draft"
    );
    const overdue = unpaid.filter((i) => i.status === "Overdue");
    const current = unpaid.filter((i) => i.status !== "Overdue");

    const collected = Number(receiptStats.totalCollected || 0);
    const receiptCount = Number(receiptStats.receiptCount || 0);

    return {
      outstandingTotal: unpaid.reduce((s, i) => s + i.balance, 0),
      unpaidCount: unpaid.length,
      currentTotal: current.reduce((s, i) => s + i.balance, 0),
      overdueTotal: overdue.reduce((s, i) => s + i.balance, 0),
      overdueCount: overdue.length,
      collectedTotal: collected,
      receiptCount,
    };
  }, [normalizedInvoices, receiptStats]);

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter((inv) => {
      if (
        activeTab === "Unpaid" &&
        (inv.status === "Paid" || inv.status === "Draft")
      )
        return false;
      if (activeTab === "Overdue" && inv.status !== "Overdue") return false;
      if (activeTab === "Draft" && inv.status !== "Draft") return false;
      if (activeTab === "Paid" && inv.status !== "Paid") return false;

      if (customerFilter !== "ALL" && inv.customer !== customerFilter)
        return false;
      if (dueFilter === "OVERDUE" && inv.status !== "Overdue") return false;
      if (dueFilter === "UPCOMING" && inv.status === "Overdue") return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !inv.displayId.toLowerCase().includes(q) &&
          !inv.customer.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [normalizedInvoices, activeTab, customerFilter, dueFilter, search]);

  async function handleStatusUpdate(rawId: number, newStatus: string) {
    try {
      // FETCH 3: PATCH ${API_URL}/api/arinvoices/${rawId}/status?status=${newStatus}
      // Backend File: finance/backend/routers/arinvoices.py -> update_ar_status()
      // Database Table: Updates "ARInvoice" status ('Sent' or 'Paid') and sets remainingBalance = 0 when Paid
      // Purpose: Updates invoice status from the View Invoice modal
      const res = await fetch(
        `${API_URL}/api/arinvoices/${rawId}/status?status=${newStatus}`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error("Failed to update invoice status");
      setViewingInvoice(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSyncFromSales() {
    setSyncing(true);
    try {
      // FETCH 4: POST ${API_URL}/api/arinvoices/sync-sales
      // Backend File: finance/backend/routers/arinvoices.py -> trigger_sales_sync()
      // Database Tables: Copies unimported rows from Team 4 "Sales Invoice" into Finance "ARInvoice"
      // Purpose: Pulls new customer invoices from Sales on demand
      const res = await fetch(`${API_URL}/api/arinvoices/sync-sales`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync from Sales");
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }
  return (
    <div className="ar-page">
      {/* Aligned Fixed Header (No subtitle, no Create Invoice button) */}
      <div className="page-header">
        <h1>AR Invoices</h1>

        <button
          type="button"
          className="primary-btn"
          onClick={handleSyncFromSales}
          disabled={syncing}
        >
          {syncing ? "Syncing Sales..." : "Sync from Sales"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Receivables</span>
          <h2>{loading ? "..." : formatCurrency(stats.outstandingTotal)}</h2>
          <small>
            {stats.unpaidCount} unpaid customer{" "}
            {stats.unpaidCount === 1 ? "invoice" : "invoices"}
          </small>
        </div>

        <div className="summary-card">
          <span>Current Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.currentTotal)}</h2>
          <small>Not yet due</small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.overdueTotal)}</h2>
          <small className={stats.overdueCount > 0 ? "warning" : ""}>
            {stats.overdueCount === 0
              ? "No overdue invoices"
              : `${stats.overdueCount} ${
                  stats.overdueCount === 1 ? "invoice needs" : "invoices need"
                } follow-up`}
          </small>
        </div>

        <div className="summary-card">
          <span>Collected Total</span>
          <h2>{loading ? "..." : formatCurrency(stats.collectedTotal)}</h2>
          <small className="success">
            {stats.receiptCount} customer{" "}
            {stats.receiptCount === 1 ? "receipt" : "receipts"}
          </small>
        </div>
      </div>

      {/* Tabs (Starts on All Invoices) */}
      <div className="ar-tabs">
        {(
          [
            { key: "ALL", label: "All Invoices" },
            { key: "Unpaid", label: "Unpaid Invoices" },
            { key: "Overdue", label: "Overdue" },
            { key: "Draft", label: "Drafts" },
            { key: "Paid", label: "Paid" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            className={activeTab === t.key ? "active" : ""}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search-input"
          placeholder="Search invoice or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
        >
          <option value="ALL">All Customers</option>
          {Array.from(new Set(normalizedInvoices.map((i) => i.customer))).map(
            (cust) => (
              <option key={cust} value={cust}>
                {cust}
              </option>
            )
          )}
        </select>

        <select
          className="filter-select"
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value)}
        >
          <option value="ALL">Due Date: Any</option>
          <option value="OVERDUE">Past Due</option>
          <option value="UPCOMING">Upcoming</option>
        </select>

        <button
          type="button"
          className="reset-filter-btn"
          onClick={() => {
            setSearch("");
            setCustomerFilter("ALL");
            setDueFilter("ALL");
            setActiveTab("ALL");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Customer Invoices</h3>
            <p>Live Accounts Receivable Register</p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={fetchData}
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <p className="state-message">Loading customer invoices...</p>
        ) : error ? (
          <p className="state-message error">Error: {error}</p>
        ) : (
          <table className="ar-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Invoice Amount</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    No customer invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.rawId}>
                    <td>
                      <strong>{invoice.displayId}</strong>
                    </td>

                    <td>
                      <div>
                        <strong>{invoice.customer}</strong>
                        <p>{invoice.description}</p>
                      </div>
                    </td>

                    <td>{invoice.dueDateFormatted}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>
                      <strong>{formatCurrency(invoice.balance)}</strong>
                    </td>

                    <td>
                      <span
                        className={`status ${invoice.status.toLowerCase()}`}
                      >
                        {invoice.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="view-btn"
                        onClick={() => setViewingInvoice(invoice)}
                      >
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* View Invoice Modal */}
      {viewingInvoice && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>{viewingInvoice.displayId}</h3>
            <p>
              <strong>Customer:</strong> {viewingInvoice.customer}
            </p>
            <p>
              <strong>Description:</strong> {viewingInvoice.description}
            </p>
            <p>
              <strong>Due Date:</strong> {viewingInvoice.dueDateFormatted}
            </p>
            <p>
              <strong>Invoice Amount:</strong>{" "}
              {formatCurrency(viewingInvoice.amount)}
            </p>
            <p>
              <strong>Balance Due:</strong>{" "}
              {formatCurrency(viewingInvoice.balance)}
            </p>
            <p>
              <strong>Status:</strong> {viewingInvoice.status}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setViewingInvoice(null)}
              >
                Close
              </button>
              {viewingInvoice.status === "Draft" && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    handleStatusUpdate(viewingInvoice.rawId, "Sent")
                  }
                >
                  Mark as Sent
                </button>
              )}
              {viewingInvoice.status !== "Paid" && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    handleStatusUpdate(viewingInvoice.rawId, "Paid")
                  }
                >
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="collection-note">
        Keep customer follow-ups up to date to reduce overdue balances.
      </div>
    </div>
  );
}
