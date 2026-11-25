"use client";

import { useEffect, useMemo, useState } from "react";
import "./invoices.css";

export default function APInvoices() {
  const [apInvoices, setApInvoices] = useState<any[]>([]);
  const [awaitingInvoices, setAwaitingInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<
    "Awaiting Finance" | "Unpaid" | "ALL" | "Overdue" | "Partially Paid" | "Paid"
  >("Awaiting Finance");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

  // Three-Way Match & Create AP Modal (From Procurement PI)
  const [reviewingPI, setReviewingPI] = useState<any | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // View Existing AP Invoice Modal
  const [viewingAP, setViewingAP] = useState<any | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setTodayStr(today);
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    setError(null);
    try {
      const [apRes, awaitingRes] = await Promise.all([
        // FETCH 1: GET /api/invoices/
        // Source: Finance "APInvoice" table joined with Team 1 "Supplier" table.
        // Purpose: Loads all official AP bills already accepted by Finance (Unpaid, Partial, Overdue, Paid).
        fetch("http://127.0.0.1:8000/api/apinvoices"),

        // FETCH 2: GET /api/invoices/awaiting-finance
        // Source: Team 1 "PurchaseInvoice" joined with "PurchaseOrder", "GoodsReceived", and "Supplier"
        //         where PI_ID does NOT yet exist in Finance "APInvoice".
        // Purpose: Loads incoming supplier invoices from Procurement waiting for Finance 3-way match & due date.
        fetch("http://127.0.0.1:8000/api/apinvoices/awaiting-finance"),
      ]);

      if (!apRes.ok) throw new Error(`AP Invoices API error: ${apRes.status}`);
      const apJson = await apRes.json();
      setApInvoices(Array.isArray(apJson) ? apJson : []);

      if (awaitingRes.ok) {
        const awaitingJson = await awaitingRes.json();
        setAwaitingInvoices(Array.isArray(awaitingJson) ? awaitingJson : []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Accounts Payable invoices");
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

  // Normalize official APInvoice records
  const normalizedAP = useMemo(() => {
    return apInvoices.map((row, idx) => {
      const id = Number(row.apInvoiceID ?? row.apinvoiceid ?? idx + 1);
      const displayId = `AP-${String(id).padStart(4, "0")}`;
      const piId = row.piID ?? row.piid ?? "-";
      const poId = row.poID ?? row.poid ?? "-";
      const supplier =
        row.supplier_name ??
        row.supplierName ??
        `Supplier #${row.supplierID ?? row.supplierid ?? "-"}`;
      const amount = Number(row.amount ?? 0);
      const totalPaid = Number(row.totalPaid ?? row.totalpaid ?? 0);
      const remaining = Number(
        row.remainingBalance ?? row.remainingbalance ?? amount - totalPaid
      );
      const dueDateRaw = row.dueDate ?? row.duedate ?? "";
      const isoDue = dueDateRaw
        ? new Date(dueDateRaw).toISOString().split("T")[0]
        : "";

      let status = row.status ?? "Unpaid";
      if (remaining <= 0 || status.toLowerCase() === "paid") {
        status = "Paid";
      } else if (todayStr && isoDue && isoDue < todayStr) {
        status = "Overdue";
      } else if (totalPaid > 0) {
        status = "Partially Paid";
      } else {
        status = "Unpaid";
      }

      return {
        id,
        displayId,
        piRef: `PI-${String(piId).padStart(4, "0")}`,
        poRef: `PO-${String(poId).padStart(4, "0")}`,
        supplier,
        amount,
        totalPaid,
        remaining,
        dueDateFormatted: formatDate(dueDateRaw),
        status,
      };
    });
  }, [apInvoices, todayStr]);

  // Summary KPIs
  const stats = useMemo(() => {
    const unpaidBills = normalizedAP.filter((b) => b.status !== "Paid");
    const overdueBills = unpaidBills.filter((b) => b.status === "Overdue");
    return {
      awaitingCount: awaitingInvoices.length,
      awaitingTotal: awaitingInvoices.reduce(
        (s, p) => s + Number(p.invoiceAmount || 0),
        0
      ),
      openTotal: unpaidBills.reduce((s, b) => s + b.remaining, 0),
      openCount: unpaidBills.length,
      overdueTotal: overdueBills.reduce((s, b) => s + b.remaining, 0),
      overdueCount: overdueBills.length,
      paidTotal: normalizedAP.reduce((s, b) => s + b.totalPaid, 0),
    };
  }, [awaitingInvoices, normalizedAP]);

  // Filtered AP rows for the active tab
  const filteredAP = useMemo(() => {
    return normalizedAP.filter((bill) => {
      if (activeTab === "Unpaid" && bill.status === "Paid") return false;
      if (activeTab === "Overdue" && bill.status !== "Overdue") return false;
      if (activeTab === "Partially Paid" && bill.status !== "Partially Paid")
        return false;
      if (activeTab === "Paid" && bill.status !== "Paid") return false;

      if (supplierFilter !== "ALL" && bill.supplier !== supplierFilter)
        return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !bill.displayId.toLowerCase().includes(q) &&
          !bill.piRef.toLowerCase().includes(q) &&
          !bill.supplier.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [normalizedAP, activeTab, supplierFilter, search]);

  function openThreeWayMatchModal(piRow: any) {
    setReviewingPI(piRow);
    // Default due date to 30 days from today
    const future = new Date();
    future.setDate(future.getDate() + 30);
    setDueDateInput(future.toISOString().split("T")[0]);
  }

  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");


  async function handleApproveAndCreateAP(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingPI || !dueDateInput) return;

    setSubmitting(true);
    try {
      // FETCH 3: POST /api/invoices/create-from-pi
      // Destination: Inserts verified PurchaseInvoice into Finance "APInvoice" table with the chosen dueDate.
      // Side Effect: Changes Procurement's read-only status from "Awaiting Finance" to "Unpaid".
      const res = await fetch(
        `${API_URL}/api/apinvoices/create-from-pi`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            piID: Number(reviewingPI.piID),
            dueDate: dueDateInput,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create AP Invoice");
      }

      setReviewingPI(null);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || "Error creating AP Invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ap-invoices-page invoices-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AP Invoices</h1>
          <p>
            Review incoming Procurement invoices, perform 3-way matching, and
            manage supplier payables.
          </p>
        </div>

        <button className="primary-btn btn-primary" onClick={fetchAllData}>
          Sync Procurement &amp; AP
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Awaiting Finance (From Procurement)</span>
          <h2>{loading ? "..." : formatCurrency(stats.awaitingTotal)}</h2>
          <small>
            {stats.awaitingCount} purchase{" "}
            {stats.awaitingCount === 1 ? "invoice" : "invoices"} to verify
          </small>
        </div>

        <div className="summary-card">
          <span>Total Open Payables</span>
          <h2>{loading ? "..." : formatCurrency(stats.openTotal)}</h2>
          <small>
            {stats.openCount} active supplier{" "}
            {stats.openCount === 1 ? "bill" : "bills"}
          </small>
        </div>

        <div className="summary-card">
          <span>Overdue Payables</span>
          <h2>{loading ? "..." : formatCurrency(stats.overdueTotal)}</h2>
          <small className={stats.overdueCount > 0 ? "warning" : ""}>
            {stats.overdueCount} overdue{" "}
            {stats.overdueCount === 1 ? "bill" : "bills"}
          </small>
        </div>

        <div className="summary-card">
          <span>Total Paid to Suppliers</span>
          <h2>{loading ? "..." : formatCurrency(stats.paidTotal)}</h2>
          <small className="success">Synced with AP Payments</small>
        </div>
      </div>

      {/* Styled Tab Buttons (Matches Original Pill/Tab Design) */}
      <div
        className="tabs"
        style={{
          display: "flex",
          gap: "0.65rem",
          flexWrap: "wrap",
          margin: "1.25rem 0 1rem 0",
        }}
      >
        {(
          [
            {
              key: "Awaiting Finance",
              label: `Awaiting Finance (${awaitingInvoices.length})`,
            },
            { key: "Unpaid", label: "Unpaid Bills" },
            { key: "Partially Paid", label: "Partially Paid" },
            { key: "Overdue", label: "Overdue" },
            { key: "Paid", label: "Paid" },
            { key: "ALL", label: "All AP Bills" },
          ] as const
        ).map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              className={isActive ? "tab active" : "tab"}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "0.6rem 1.15rem",
                borderRadius: "10px",
                border: isActive ? "1px solid #dbeafe" : "1px solid #edf0f4",
                backgroundColor: isActive ? "#f1f6fd" : "#ffffff",
                color: isActive ? "#25578a" : "#111827",
                fontWeight: 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters (Shown for AP Bills tabs) */}
      {activeTab !== "Awaiting Finance" && (
        <div
          className="filter-bar filters"
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search AP ID, PI reference, or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
            }}
          />

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
            }}
          >
            <option value="ALL">All Suppliers</option>
            {Array.from(new Set(normalizedAP.map((b) => b.supplier))).map(
              (sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              )
            )}
          </select>

          <button
            onClick={() => {
              setSearch("");
              setSupplierFilter("ALL");
            }}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Main Table Section */}
      <div className="table-card">
        {loading ? (
          <p style={{ padding: "1rem" }}>Loading Procurement &amp; AP data...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : activeTab === "Awaiting Finance" ? (
          <>
            <div className="table-header">
              <div>
                <h3>Incoming Purchase Invoices (Awaiting Finance)</h3>
                <p>
                  Verify Purchase Order, Goods Received, and Invoice amounts
                  before creating an AP bill.
                </p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Purchase Invoice</th>
                  <th>Supplier</th>
                  <th>PO Reference</th>
                  <th>Goods Received</th>
                  <th>PO Amount</th>
                  <th>Invoice Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {awaitingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                      All Procurement purchase invoices have been processed into
                      AP!
                    </td>
                  </tr>
                ) : (
                  awaitingInvoices.map((pi) => {
                    const poAmt = Number(pi.poAmount ?? 0);
                    const invAmt = Number(pi.invoiceAmount ?? 0);
                    const isMatched =
                      pi.grID !== null &&
                      (poAmt === 0 || Math.abs(poAmt - invAmt) < 0.01);

                    return (
                      <tr key={pi.piID}>
                        <td>PI-{String(pi.piID).padStart(4, "0")}</td>
                        <td>
                          <strong>
                            {pi.supplierName || `Supplier #${pi.supplierID}`}
                          </strong>
                          <p>Dated {formatDate(pi.invoiceDate)}</p>
                        </td>
                        <td>
                          {pi.poID
                            ? `PO-${String(pi.poID).padStart(4, "0")}`
                            : "-"}
                        </td>
                        <td>
                          {pi.grID
                            ? `GR-${String(pi.grID).padStart(4, "0")} (${
                                pi.grStatus || "Received"
                              })`
                            : "Pending GR"}
                        </td>
                        <td>{poAmt > 0 ? formatCurrency(poAmt) : "-"}</td>
                        <td>
                          <strong>{formatCurrency(invAmt)}</strong>
                        </td>
                        <td>
                          <span
                            className={`status ${
                              isMatched ? "matched" : "warning"
                            }`}
                          >
                            {isMatched ? "3-Way Match Ready" : "Check Match"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="primary-btn"
                            onClick={() => openThreeWayMatchModal(pi)}
                          >
                            Create AP Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="table-header">
              <div>
                <h3>Accounts Payable Register</h3>
                <p>
                  Official supplier liabilities synced with Procurement
                  (read-only status) &amp; AP Payments.
                </p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>AP Invoice ID</th>
                  <th>Supplier &amp; Refs</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Amount Paid</th>
                  <th>Remaining Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredAP.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                      No AP invoices found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredAP.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <strong>{bill.displayId}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{bill.supplier}</strong>
                          <p>
                            {bill.piRef} • {bill.poRef}
                          </p>
                        </div>
                      </td>
                      <td>{bill.dueDateFormatted}</td>
                      <td>{formatCurrency(bill.amount)}</td>
                      <td>{formatCurrency(bill.totalPaid)}</td>
                      <td>
                        <strong>{formatCurrency(bill.remaining)}</strong>
                      </td>
                      <td>
                        <span
                          className={`status ${bill.status
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="view-btn"
                          onClick={() => setViewingAP(bill)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Three-Way Match & Create AP Invoice Modal */}
      {reviewingPI && (
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
            onSubmit={handleApproveAndCreateAP}
            style={{
              backgroundColor: "#ffffff",
              padding: "1.5rem",
              borderRadius: "10px",
              width: "450px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3 style={{ margin: 0 }}>Three-Way Match &amp; Create AP</h3>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "0.88rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div>
                <strong>Supplier:</strong>{" "}
                {reviewingPI.supplierName ||
                  `Supplier #${reviewingPI.supplierID}`}
              </div>
              <div>
                <strong>1. Purchase Order (PO):</strong>{" "}
                {reviewingPI.poID
                  ? `PO-${String(reviewingPI.poID).padStart(4, "0")} (${formatCurrency(
                      reviewingPI.poAmount
                    )})`
                  : "No PO linked"}
              </div>
              <div>
                <strong>2. Goods Received (GR):</strong>{" "}
                {reviewingPI.grID
                  ? `GR-${String(reviewingPI.grID).padStart(4, "0")} — ${
                      reviewingPI.grStatus || "Confirmed"
                    }`
                  : "⚠️ Not yet confirmed by Inventory"}
              </div>
              <div>
                <strong>3. Purchase Invoice (PI):</strong> PI-
                {String(reviewingPI.piID).padStart(4, "0")} —{" "}
                <strong>{formatCurrency(reviewingPI.invoiceAmount)}</strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Set Payment Due Date *</label>
              <input
                type="date"
                required
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                style={{
                  padding: "0.55rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              />
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
                onClick={() => setReviewingPI(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={submitting}
              >
                {submitting ? "Creating AP..." : "Confirm & Create AP Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View AP Details Modal */}
      {viewingAP && (
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
              width: "400px",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <h3 style={{ margin: 0 }}>{viewingAP.displayId} Details</h3>
            <p>
              <strong>Supplier:</strong> {viewingAP.supplier}
            </p>
            <p>
              <strong>References:</strong> {viewingAP.piRef} / {viewingAP.poRef}
            </p>
            <p>
              <strong>Due Date:</strong> {viewingAP.dueDateFormatted}
            </p>
            <p>
              <strong>Total Amount:</strong> {formatCurrency(viewingAP.amount)}
            </p>
            <p>
              <strong>Amount Paid:</strong> {formatCurrency(viewingAP.totalPaid)}
            </p>
            <p>
              <strong>Remaining Balance:</strong>{" "}
              {formatCurrency(viewingAP.remaining)}
            </p>
            <p>
              <strong>Status:</strong> {viewingAP.status}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.5rem",
              }}
            >
              <button
                onClick={() => setViewingAP(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}