"use client";

import { useEffect, useMemo, useState } from "react";
import "./invoices.css";

export default function ARInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [receiptStats, setReceiptStats] = useState({ totalCollected: 0, receiptCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"Unpaid" | "ALL" | "Overdue" | "Draft" | "Paid">("Unpaid");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create Form State
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSalesInvId, setFormSalesInvId] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formStatus, setFormStatus] = useState("Sent");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T"));
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [invRes, custRes, recRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/payments"),
        fetch("http://127.0.0.1:8000/api/payments"),
        fetch("http://127.0.0.1:8000/api/payments"),
      ]);

      if (!invRes.ok) throw new Error(`AR API error: ${invRes.status}`);
      setInvoices(await invRes.json());

      if (custRes.ok) setCustomers(await custRes.json());
      if (recRes.ok) setReceiptStats(await recRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to load AR invoices");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const normalizedInvoices = useMemo(() => {
    return invoices.map((row, idx) => {
      const rawId = row.arInvoiceID ?? row.arinvoiceid ?? row.id ?? idx + 1;
      const displayId = `INV-${String(rawId).padStart(4, "0")}`;
      const custId = row.customerID ?? row.customerid ?? "";
      const customer = row.customer_name ?? row.customerName ?? (custId ? `Customer #${custId}` : "Walk-in Customer");
      const salesRef = row.salesInvoiceID ?? row.salesinvoiceid;
      const description = salesRef ? `Sales Invoice #${salesRef}` : "Customer Receivable";
      const dueDateRaw = row.dueDate ?? row.duedate ?? "";
      const isoDue = dueDateRaw ? new Date(dueDateRaw).toISOString().split("T") : "";
      const amount = Number(row.amount ?? 0);
      const balance = Number(row.remainingBalance ?? row.remainingbalance ?? amount);

      let status = row.status ?? "Sent";
      if (balance <= 0 || status.toLowerCase() === "paid") {
        status = "Paid";
      } else if (status.toLowerCase() !== "draft" && todayStr && isoDue && isoDue < todayStr) {
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
    });
  }, [invoices, todayStr]);

  const stats = useMemo(() => {
    const unpaid = normalizedInvoices.filter((i) => i.status !== "Paid" && i.status !== "Draft");
    const overdue = unpaid.filter((i) => i.status === "Overdue");
    const current = unpaid.filter((i) => i.status !== "Overdue");
    const paidInvoices = normalizedInvoices.filter((i) => i.status === "Paid");

    const collected =
      receiptStats.totalCollected > 0
        ? receiptStats.totalCollected
        : paidInvoices.reduce((s, i) => s + i.amount, 0);

    return {
      outstandingTotal: unpaid.reduce((s, i) => s + i.balance, 0),
      unpaidCount: unpaid.length,
      currentTotal: current.reduce((s, i) => s + i.balance, 0),
      overdueTotal: overdue.reduce((s, i) => s + i.balance, 0),
      overdueCount: overdue.length,
      collectedTotal: collected,
      receiptCount: receiptStats.receiptCount || paidInvoices.length,
    };
  }, [normalizedInvoices, receiptStats]);

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter((inv) => {
      if (activeTab === "Unpaid" && (inv.status === "Paid" || inv.status === "Draft")) return false;
      if (activeTab === "Overdue" && inv.status !== "Overdue") return false;
      if (activeTab === "Draft" && inv.status !== "Draft") return false;
      if (activeTab === "Paid" && inv.status !== "Paid") return false;

      if (customerFilter !== "ALL" && inv.customer !== customerFilter) return false;
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

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!formCustomerId || !formDueDate || !formAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerID: Number(formCustomerId),
          salesInvoiceID: formSalesInvId ? Number(formSalesInvId) : null,
          dueDate: formDueDate,
          amount: Number(formAmount),
          status: formStatus,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create invoice");
      }
      setShowCreateModal(false);
      setFormAmount("");
      setFormSalesInvId("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusUpdate(rawId: number, newStatus: string) {
    try {
      const res = await fetch(
        `http://127.0.0/${rawId}/status?status=${newStatus}`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error("Failed to update invoice status");
      setViewingInvoice(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

    return (
    <div className="ar-page">
      <div className="page-header">
        <div>
          <h1>AR Invoices</h1>
          <p>
            Send customer invoices, track due dates and stay on top of receivables.
          </p>
        </div>

        <button className="create-btn" onClick={() => setShowCreateModal(true)}>
          Create Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Receivables</span>
          <h2>{loading ? "..." : formatCurrency(stats.outstandingTotal)}</h2>
          <small>
            {stats.unpaidCount} unpaid customer {stats.unpaidCount === 1 ? "invoice" : "invoices"}
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
              : `${stats.overdueCount} ${stats.overdueCount === 1 ? "invoice needs" : "invoices need"} follow-up`}
          </small>
        </div>

        <div className="summary-card">
          <span>Collected Total</span>
          <h2>{loading ? "..." : formatCurrency(stats.collectedTotal)}</h2>
          <small className="success">
            {stats.receiptCount} customer {stats.receiptCount === 1 ? "receipt" : "receipts"}
          </small>
        </div>
      </div>

      {/* Tabs */}
      <div className="ar-tabs">
        {(
          [
            { key: "Unpaid", label: "Unpaid Invoices" },
            { key: "ALL", label: "All Invoices" },
            { key: "Overdue", label: "Overdue" },
            { key: "Draft", label: "Drafts" },
            { key: "Paid", label: "Paid" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
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
          placeholder="Search invoice or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
        >
          <option value="ALL">All Customers</option>
          {Array.from(new Set(normalizedInvoices.map((i) => i.customer))).map((cust) => (
            <option key={cust} value={cust}>
              {cust}
            </option>
          ))}
        </select>

        <select
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value)}
        >
          <option value="ALL">Due Date: Any</option>
          <option value="OVERDUE">Past Due</option>
          <option value="UPCOMING">Upcoming</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setCustomerFilter("ALL");
            setDueFilter("ALL");
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

          <button className="secondary-btn" onClick={fetchData}>
            Refresh List
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading customer invoices...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
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
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No customer invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.rawId}>
                    <td>{invoice.displayId}</td>

                    <td>
                      <div>
                        <strong>{invoice.customer}</strong>
                        <p>{invoice.description}</p>
                      </div>
                    </td>

                    <td>{invoice.dueDateFormatted}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>{formatCurrency(invoice.balance)}</td>

                    <td>
                      <span className={`status ${invoice.status.toLowerCase()}`}>
                        {invoice.status}
                      </span>
                    </td>

                    <td>
                      <button
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

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleCreateInvoice}
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>Create AR Invoice</h3>

            <label>Customer *</label>
            {customers.length > 0 ? (
              <select
                required
                value={formCustomerId}
                onChange={(e) => setFormCustomerId(e.target.value)}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c, idx) => {
                  const id = c.customerID ?? c.customerid ?? c.id ?? idx;
                  const name = c.customerName ?? c.customername ?? c.name ?? `Customer #${id}`;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="number"
                required
                placeholder="Customer ID (e.g. 1)"
                value={formCustomerId}
                onChange={(e) => setFormCustomerId(e.target.value)}
              />
            )}

            <label>Sales Invoice ID (Optional)</label>
            <input
              type="number"
              placeholder="e.g. 101"
              value={formSalesInvId}
              onChange={(e) => setFormSalesInvId(e.target.value)}
            />

            <label>Due Date *</label>
            <input
              type="date"
              required
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />

            <label>Invoice Amount *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <label>Initial Status</label>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
              <option value="Sent">Sent</option>
              <option value="Draft">Draft</option>
            </select>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="create-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Invoice Modal */}
      {viewingInvoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>{viewingInvoice.displayId}</h3>
            <p><strong>Customer:</strong> {viewingInvoice.customer}</p>
            <p><strong>Description:</strong> {viewingInvoice.description}</p>
            <p><strong>Due Date:</strong> {viewingInvoice.dueDateFormatted}</p>
            <p><strong>Invoice Amount:</strong> {formatCurrency(viewingInvoice.amount)}</p>
            <p><strong>Balance Due:</strong> {formatCurrency(viewingInvoice.balance)}</p>
            <p><strong>Status:</strong> {viewingInvoice.status}</p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button onClick={() => setViewingInvoice(null)}>Close</button>
              {viewingInvoice.status === "Draft" && (
                <button
                  className="secondary-btn"
                  onClick={() => handleStatusUpdate(viewingInvoice.rawId, "Sent")}
                >
                  Mark as Sent
                </button>
              )}
              {viewingInvoice.status !== "Paid" && (
                <button
                  className="create-btn"
                  onClick={() => handleStatusUpdate(viewingInvoice.rawId, "Paid")}
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