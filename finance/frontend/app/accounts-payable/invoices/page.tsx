"use client";

import { useEffect, useMemo, useState } from "react";
import "./invoices.css";

export default function APInvoices() {
  const [apInvoices, setApInvoices] = useState<any[]>([]);
  const [awaitingInvoices, setAwaitingInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  // Dropdown Status Filter (Defaults to "ALL" = All AP Bills) & Search
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "Awaiting Finance" | "Unpaid" | "Partially Paid" | "Overdue" | "Paid"
  >("ALL");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

  // Three-Way Match & Create AP Modal (From Procurement PI)
  const [reviewingPI, setReviewingPI] = useState<any | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // View Existing AP Invoice Modal
  const [viewingAP, setViewingAP] = useState<any | null>(null);

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

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
        // FETCH 1: GET /api/apinvoices
        // Source: Finance "APInvoice" table joined with Team 1 "Supplier" table.
        // Purpose: Loads all official AP bills already accepted by Finance (Unpaid, Partial, Overdue, Paid).
        fetch(`${API_URL}/api/apinvoices`),

        // FETCH 2: GET /api/apinvoices/awaiting-finance
        // Source: Team 1 "PurchaseInvoice" joined with "PurchaseOrder", "GoodsReceived", and "Supplier"
        //         where PI_ID does NOT yet exist in Finance "APInvoice".
        // Purpose: Loads incoming supplier invoices from Procurement waiting for Finance 3-way match & due date.
        fetch(`${API_URL}/api/awaiting-finance`),
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

  // Normalize official APInvoice records & sort newest on top (apInvoiceID DESC)
  const normalizedAP = useMemo(() => {
    return apInvoices
      .map((row, idx) => {
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
      })
      .sort((a, b) => b.id - a.id);
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

  // Filtered AP rows for the active status dropdown selection
  const filteredAP = useMemo(() => {
    return normalizedAP.filter((bill) => {
      if (statusFilter === "Unpaid" && bill.status === "Paid") return false;
      if (statusFilter === "Overdue" && bill.status !== "Overdue") return false;
      if (
        statusFilter === "Partially Paid" &&
        bill.status !== "Partially Paid"
      )
        return false;
      if (statusFilter === "Paid" && bill.status !== "Paid") return false;

      if (supplierFilter !== "ALL" && bill.supplier !== supplierFilter)
        return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !bill.displayId.toLowerCase().includes(q) &&
          !bill.piRef.toLowerCase().includes(q) &&
          !bill.poRef.toLowerCase().includes(q) &&
          !bill.supplier.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [normalizedAP, statusFilter, supplierFilter, search]);

  // Filtered Awaiting Finance rows sorted newest PI on top
  const filteredAwaiting = useMemo(() => {
    return [...awaitingInvoices]
      .sort((a, b) => Number(b.piID || 0) - Number(a.piID || 0))
      .filter((pi) => {
        const sup = pi.supplierName || `Supplier #${pi.supplierID}`;
        if (supplierFilter !== "ALL" && sup !== supplierFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const piRef = `pi-${String(pi.piID).padStart(4, "0")}`;
          const poRef = pi.poID
            ? `po-${String(pi.poID).padStart(4, "0")}`
            : "";
          if (
            !piRef.includes(q) &&
            !poRef.includes(q) &&
            !sup.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      });
  }, [awaitingInvoices, supplierFilter, search]);

  function openThreeWayMatchModal(piRow: any) {
    setReviewingPI(piRow);
    const future = new Date();
    future.setDate(future.getDate() + 30);
    setDueDateInput(future.toISOString().split("T")[0]);
  }

  async function handleApproveAndCreateAP(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingPI || !dueDateInput) return;

    setSubmitting(true);
    try {
      // FETCH 3: POST /api/apinvoices/create-from-pi
      // Destination: Inserts verified PurchaseInvoice into Finance "APInvoice" table with the chosen dueDate.
      // Side Effect: Changes Procurement's read-only status from "Awaiting Finance" to "Unpaid".
      const res = await fetch(`${API_URL}/api/apinvoices/create-from-pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          piID: Number(reviewingPI.piID),
          dueDate: dueDateInput,
        }),
      });

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
      {/* Aligned Fixed Header (No subtitle, matches Chart of Accounts) */}
      <div className="page-header">
        <h1>AP Invoices</h1>

        <button
          type="button"
          className="primary-btn btn-primary"
          onClick={fetchAllData}
        >
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

      {/* Unified Search Bar & Status Dropdown (Default: All AP Bills) */}
      <div className="filter-bar filters">
        <input
          type="text"
          className="filter-search-input"
          placeholder="Search AP ID, PI/PO reference, or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          aria-label="Filter AP Invoices by Status"
        >
          <option value="ALL">All AP Bills</option>
          <option value="Awaiting Finance">
            Awaiting Finance ({awaitingInvoices.length})
          </option>
          <option value="Unpaid">Unpaid Bills</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Paid">Paid</option>
        </select>

        <select
          className="filter-select"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          aria-label="Filter by Supplier"
        >
          <option value="ALL">All Suppliers</option>
          {Array.from(
            new Set([
              ...normalizedAP.map((b) => b.supplier),
              ...awaitingInvoices.map(
                (pi) => pi.supplierName || `Supplier #${pi.supplierID}`
              ),
            ])
          ).map((sup) => (
            <option key={sup} value={sup}>
              {sup}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="reset-filter-btn"
          onClick={() => {
            setSearch("");
            setStatusFilter("ALL");
            setSupplierFilter("ALL");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Main Table Section */}
      <div className="table-card">
        {loading ? (
          <p className="state-message">Loading Procurement &amp; AP data...</p>
        ) : error ? (
          <p className="state-message error">Error: {error}</p>
        ) : statusFilter === "Awaiting Finance" ? (
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

            <table className="ap-table">
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
                {filteredAwaiting.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-table-cell">
                      All Procurement purchase invoices have been processed into
                      AP!
                    </td>
                  </tr>
                ) : (
                  filteredAwaiting.map((pi) => {
                    const poAmt = Number(pi.poAmount ?? 0);
                    const invAmt = Number(pi.invoiceAmount ?? 0);
                    const isMatched =
                      pi.grID !== null &&
                      (poAmt === 0 || Math.abs(poAmt - invAmt) < 0.01);

                    return (
                      <tr key={pi.piID}>
                        <td>
                          <strong>PI-{String(pi.piID).padStart(4, "0")}</strong>
                        </td>
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
                            type="button"
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

            <table className="ap-table">
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
                    <td colSpan={8} className="empty-table-cell">
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
                          type="button"
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
        <div className="modal-overlay">
          <form className="modal-box" onSubmit={handleApproveAndCreateAP}>
            <h3>Three-Way Match &amp; Create AP</h3>

            <div className="match-summary-card">
              <div>
                <strong>Supplier:</strong>{" "}
                {reviewingPI.supplierName ||
                  `Supplier #${reviewingPI.supplierID}`}
              </div>
              <div>
                <strong>1. Purchase Order (PO):</strong>{" "}
                {reviewingPI.poID
                  ? `PO-${String(reviewingPI.poID).padStart(
                      4,
                      "0"
                    )} (${formatCurrency(reviewingPI.poAmount)})`
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

            <div className="modal-field">
              <label>Set Payment Due Date *</label>
              <input
                type="date"
                className="modal-input"
                required
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setReviewingPI(null)}
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
        <div className="modal-overlay">
          <div className="modal-box details-modal">
            <h3>{viewingAP.displayId} Details</h3>
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

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setViewingAP(null)}
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
