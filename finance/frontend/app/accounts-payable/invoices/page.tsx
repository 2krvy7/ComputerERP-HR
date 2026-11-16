"use client";

import { useEffect, useMemo, useState } from "react";
import "./invoices.css";

export default function APInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState<string>("");

  // Filter states
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");

  // Modal states
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewingBill, setViewingBill] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New invoice form state
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formBillNo, setFormBillNo] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [invRes, supRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/apinvoices/"),
        fetch("http://127.0.0.1:8000/api/apinvoices/"),
      ]);

      if (!invRes.ok) throw new Error(`Invoices API error: ${invRes.status}`);
      const invJson = await invRes.json();
      setInvoices(Array.isArray(invJson) ? invJson : []);

      if (supRes.ok) {
        const supJson = await supRes.json();
        setSuppliers(Array.isArray(supJson) ? supJson : []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch AP invoices");
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
      const rawId = row.invoiceID ?? row.id ?? idx + 1;
      const displayId = row.invoiceNumber ?? `BILL-${String(rawId).padStart(4, "0")}`;
      const supplier = row.supplier_name ?? row.supplierName ?? `Supplier #${row.supplierID ?? "-"}`;
      const category = row.category ?? row.description ?? "Supplier Bill";
      const dueDateRaw = row.dueDate ? new Date(row.dueDate).toISOString().split("T")[0] : "";
      const amount = Number(row.amount ?? row.totalAmount ?? 0);
      const outstanding = Number(row.outstanding ?? row.balanceDue ?? amount);

      let status = row.status ?? "Open";
      if (outstanding <= 0 || status.toLowerCase() === "paid") {
        status = "Paid";
      } else if (todayStr && dueDateRaw && dueDateRaw < todayStr) {
        status = "Overdue";
      }

      return {
        rawId,
        displayId,
        supplier,
        category,
        dueDateRaw,
        dueDateFormatted: formatDate(row.dueDate),
        amount,
        outstanding,
        status,
      };
    });
  }, [invoices, todayStr]);

  const stats = useMemo(() => {
    const unpaid = normalizedInvoices.filter((i) => i.status !== "Paid");
    const overdue = unpaid.filter((i) => i.status === "Overdue");
    const current = unpaid.filter((i) => i.status !== "Overdue");
    const paid = normalizedInvoices.filter((i) => i.status === "Paid");

    return {
      outstandingTotal: unpaid.reduce((sum, i) => sum + i.outstanding, 0),
      unpaidCount: unpaid.length,
      currentTotal: current.reduce((sum, i) => sum + i.outstanding, 0),
      overdueTotal: overdue.reduce((sum, i) => sum + i.outstanding, 0),
      overdueCount: overdue.length,
      paidTotal: paid.reduce((sum, i) => sum + i.amount, 0),
      paidCount: paid.length,
    };
  }, [normalizedInvoices]);

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter((inv) => {
      const matchesSearch =
        inv.displayId.toLowerCase().includes(search.toLowerCase()) ||
        inv.supplier.toLowerCase().includes(search.toLowerCase());

      const matchesSupplier =
        selectedSupplier === "ALL" || inv.supplier === selectedSupplier;

      const matchesDue =
        dueFilter === "ALL" ||
        (dueFilter === "OVERDUE" && inv.status === "Overdue") ||
        (dueFilter === "OPEN" && inv.status === "Open") ||
        (dueFilter === "PAID" && inv.status === "Paid");

      return matchesSearch && matchesSupplier && matchesDue;
    });
  }, [normalizedInvoices, search, selectedSupplier, dueFilter]);

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!formSupplierId || !formDueDate || !formAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierID: Number(formSupplierId),
          invoiceNumber: formBillNo || null,
          dueDate: formDueDate,
          amount: Number(formAmount),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create invoice");
      }
      setShowNewModal(false);
      setFormBillNo("");
      setFormAmount("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPaid(rawId: number) {
    try {
      const res = await fetch(`http://127.0.0${rawId}/pay`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark invoice as paid");
      setViewingBill(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

   return (
    <div className="ap-page">
      <div className="ap-header">
        <div>
          <h1>AP Invoices</h1>
          <p>
            Track supplier bills, upcoming due dates and amounts owed.
          </p>
        </div>

        <button className="new-invoice-btn" onClick={() => setShowNewModal(true)}>
          New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Payables</span>
          <h2>{loading ? "..." : formatCurrency(stats.outstandingTotal)}</h2>
          <small>{stats.unpaidCount} unpaid supplier bills</small>
        </div>

        <div className="summary-card">
          <span>Current Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.currentTotal)}</h2>
          <small>Not yet due</small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.overdueTotal)}</h2>
          <small className={stats.overdueCount > 0 ? "danger" : ""}>
  {stats.overdueCount === 0
    ? "No overdue bills"
    : `${stats.overdueCount} ${stats.overdueCount === 1 ? "bill needs" : "bills need"} attention`}
</small>
        </div>

        <div className="summary-card">
          <span>Paid Total</span>
          <h2>{loading ? "..." : formatCurrency(stats.paidTotal)}</h2>
          <small>{stats.paidCount} completed payments</small>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search bill or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
        >
          <option value="ALL">All Suppliers</option>
          {suppliers.map((s, idx) => {
  const id = s.supplierid ?? s.SupplierID ?? idx;
  const name = s.suppliername ?? s.SupplierName ?? `Supplier #${id}`;
  return (
    <option key={id} value={name}>
      {name}
    </option>
  );
})}
        </select>

        <select
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value)}
        >
          <option value="ALL">Status / Due Date: Any</option>
          <option value="OVERDUE">Overdue Only</option>
          <option value="OPEN">Open (Not Yet Due)</option>
          <option value="PAID">Paid</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setSelectedSupplier("ALL");
            setDueFilter("ALL");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Invoice Table */}
      <div className="invoice-table-container">
        <div className="table-top">
          <div>
            <h3>Supplier Invoices</h3>
            <p>Select invoices to review or settle payments</p>
          </div>

          <button className="schedule-btn" onClick={fetchData}>
            Refresh List
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading supplier invoices...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Supplier</th>
                <th>Due Date</th>
                <th>Invoice Amount</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No supplier invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.rawId}>
                    <td>{invoice.displayId}</td>

                    <td>
                      <div>
                        <strong>{invoice.supplier}</strong>
                        <p>{invoice.category}</p>
                      </div>
                    </td>

                    <td>{invoice.dueDateFormatted}</td>

                    <td>{formatCurrency(invoice.amount)}</td>

                    <td>{formatCurrency(invoice.outstanding)}</td>

                    <td>
                      <span
                        className={`status-badge ${invoice.status.toLowerCase()}`}
                      >
                        {invoice.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="view-link"
                        onClick={() => setViewingBill(invoice)}
                      >
                        View Bill
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Invoice Modal */}
      {showNewModal && (
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
            <h3>New Supplier Invoice</h3>

            <label>Supplier *</label>
            <select
              required
              value={formSupplierId}
              onChange={(e) => setFormSupplierId(e.target.value)}
            >
              <option value="">-- Select Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.SupplierID} value={s.SupplierID}>
                  {s.SupplierName}
                </option>
              ))}
            </select>

            <label>Bill / Reference Number</label>
            <input
              type="text"
              placeholder="e.g. BILL-0295"
              value={formBillNo}
              onChange={(e) => setFormBillNo(e.target.value)}
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button type="submit" className="new-invoice-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View / Pay Bill Modal */}
      {viewingBill && (
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
            <h3>{viewingBill.displayId}</h3>
            <p><strong>Supplier:</strong> {viewingBill.supplier}</p>
            <p><strong>Due Date:</strong> {viewingBill.dueDateFormatted}</p>
            <p><strong>Total Amount:</strong> {formatCurrency(viewingBill.amount)}</p>
            <p><strong>Outstanding:</strong> {formatCurrency(viewingBill.outstanding)}</p>
            <p><strong>Status:</strong> {viewingBill.status}</p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button onClick={() => setViewingBill(null)}>Close</button>
              {viewingBill.status !== "Paid" && (
                <button
                  className="schedule-btn"
                  onClick={() => handleMarkPaid(viewingBill.rawId)}
                >
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="footer-note">
        Keep supplier relationships healthy.
        Prioritize overdue invoices before scheduling
        new payments.
      </div>
    </div>
  );
}