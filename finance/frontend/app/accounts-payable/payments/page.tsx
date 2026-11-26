"use client";

import { useEffect, useMemo, useState } from "react";
import "./payments.css";

export default function APPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

  // Record Payment Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [payRes, optRes, invRes, bankRes] = await Promise.all([
        // FETCH 1: GET ${API_URL}/api/payments
        // Backend File: finance/backend/routers/payments.py -> get_payments()
        // Database Tables: Reads "APPayment" joined with "APInvoice", "Supplier", and "BankAccount"
        // Purpose: Loads all recorded supplier disbursements for the main register table
        fetch(`${API_URL}/api/payments`),

        // FETCH 2: GET ${API_URL}/api/payments/options
        // Backend File: finance/backend/routers/payments.py -> get_payment_options()
        // Database Tables: Reads unpaid "APInvoice" rows and registered "BankAccount" rows
        // Purpose: Populates the Record Payment modal dropdowns
        fetch(`${API_URL}/api/payments/options`),

        // FETCH 3 (Fallback Invoices): GET ${API_URL}/api/apinvoices
        // Backend File: finance/backend/routers/apinvoices.py -> get_ap_invoices()
        // Database Tables: Reads "APInvoice" joined with "Supplier"
        // Purpose: Ensures open AP invoices still load if /options returns empty
        fetch(`${API_URL}/api/apinvoices`),

        // FETCH 4 (Fallback Bank Accounts): GET ${API_URL}/api/bank
        // Backend File: finance/backend/routers/bank.py -> get_bank_accounts()
        // Database Tables: Reads "BankAccount" with active disbursement status
        // Purpose: Ensures active disbursement bank accounts always appear in the dropdown
        fetch(`${API_URL}/api/bank`),
      ]);

      if (!payRes.ok) throw new Error(`Payments API error: ${payRes.status}`);
      const payJson = await payRes.json();
      setPayments(Array.isArray(payJson) ? payJson : []);

      let loadedInvoices: any[] = [];
      let loadedBanks: any[] = [];

      if (optRes.ok) {
        const optJson = await optRes.json();
        loadedInvoices = Array.isArray(optJson.openInvoices)
          ? optJson.openInvoices
          : [];
        loadedBanks = Array.isArray(optJson.bankAccounts)
          ? optJson.bankAccounts
          : [];
      }

      if (loadedInvoices.length === 0 && invRes.ok) {
        const allInv = await invRes.json();
        loadedInvoices = (Array.isArray(allInv) ? allInv : []).filter(
          (inv: any) => {
            const rem = Number(
              inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
            );
            const stat = String(inv.status ?? "unpaid").toLowerCase();
            return rem > 0 && stat !== "paid";
          }
        );
      }

      if (loadedBanks.length === 0 && bankRes.ok) {
        const allBanks = await bankRes.json();
        loadedBanks = Array.isArray(allBanks) ? allBanks : [];
      }

      const activeDisbursementBanks = loadedBanks.filter(
        (b: any) => b.isDisbursement !== false && b.isdisbursement !== false
      );

      setOpenInvoices(loadedInvoices);
      setBankAccounts(activeDisbursementBanks);

      if (activeDisbursementBanks.length === 1) {
        setSelectedBankId(String(activeDisbursementBanks[0].bankAccountID));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load AP payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPaymentDate(new Date().toISOString().split("T")[0]);
    fetchData();
  }, []);

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

  const activeInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return (
      openInvoices.find(
        (inv) =>
          String(inv.apInvoiceID ?? inv.apinvoiceid) ===
          String(selectedInvoiceId)
      ) || null
    );
  }, [openInvoices, selectedInvoiceId]);

  function handleSelectInvoice(invId: string) {
    setSelectedInvoiceId(invId);
    const found = openInvoices.find(
      (inv) =>
        String(inv.apInvoiceID ?? inv.apinvoiceid) === String(invId)
    );
    if (found) {
      setPaymentAmount(
        String(
          found.remainingBalance ??
            found.remainingbalance ??
            found.amount ??
            ""
        )
      );
    } else {
      setPaymentAmount("");
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(paymentAmount);

    if (
      !selectedInvoiceId ||
      !selectedBankId ||
      !paymentDate ||
      numericAmount <= 0
    ) {
      alert(
        "Please fill out all fields and enter a valid amount greater than 0."
      );
      return;
    }

    setSubmitting(true);
    try {
      // FETCH 5: POST ${API_URL}/api/payments
      // Backend File: finance/backend/routers/payments.py -> create_payment()
      // Database Tables: Inserts into "APPayment" and updates "APInvoice" (totalPaid, remainingBalance, status)
      // Purpose: Records supplier payment and deducts cash outflow from the chosen BankAccount
      const res = await fetch(`${API_URL}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apInvoiceID: Number(selectedInvoiceId),
          bankAccountID: Number(selectedBankId),
          paymentDate,
          amount: numericAmount,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to record payment");
      }

      setShowModal(false);
      setSelectedInvoiceId("");
      setPaymentAmount("");
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Error recording payment");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPaidAmount = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments]
  );

  const openPayablesTotal = useMemo(
    () =>
      openInvoices.reduce(
        (sum, inv) =>
          sum +
          Number(
            inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
          ),
        0
      ),
    [openInvoices]
  );

  // Unique supplier list for the dropdown filter
  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      if (p.supplier_name) set.add(String(p.supplier_name));
    }
    return Array.from(set).sort();
  }, [payments]);

  // Filter by supplier dropdown + search text, sorted newest payment on top
  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase();
    return [...payments]
      .sort((a, b) => Number(b.paymentID || 0) - Number(a.paymentID || 0))
      .filter((p) => {
        const rawSupplier = String(p.supplier_name || "");
        if (supplierFilter !== "ALL" && rawSupplier !== supplierFilter) {
          return false;
        }
        const payId = `pay-${String(p.paymentID).padStart(4, "0")}`;
        const billId = `bill-${String(p.apInvoiceID).padStart(4, "0")}`;
        const supplier = rawSupplier.toLowerCase();
        const bank = String(p.bank_name || "").toLowerCase();
        return (
          payId.includes(q) ||
          billId.includes(q) ||
          supplier.includes(q) ||
          bank.includes(q)
        );
      });
  }, [payments, supplierFilter, search]);

    return (
    <div className="payments-page">
      {/* Aligned Fixed Header (No subtitle, matches other pages) */}
      <div className="page-header">
        <h1>AP Payments</h1>

        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            fetchData();
            setShowModal(true);
          }}
        >
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Total Payments Disbursed</span>
          <h2>{loading ? "..." : formatCurrency(totalPaidAmount)}</h2>
          <small>{payments.length} completed disbursements</small>
        </div>

        <div className="summary-card">
          <span>Open Bills Remaining</span>
          <h2>{loading ? "..." : formatCurrency(openPayablesTotal)}</h2>
          <small>{openInvoices.length} unpaid supplier bills</small>
        </div>

        <div className="summary-card">
          <span>Active Disbursement Accounts</span>
          <h2>{loading ? "..." : bankAccounts.length}</h2>
          <small>
            {bankAccounts.length > 0
              ? "Ready for disbursement"
              : "0 active disbursement accounts"}
          </small>
        </div>
      </div>

      {/* Search Bar, Supplier Dropdown & Refresh */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search-input"
          placeholder="Search payment ID, bill, supplier, or bank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          aria-label="Filter payments by supplier"
        >
          <option value="ALL">All Suppliers</option>
          {availableSuppliers.map((sup) => (
            <option key={sup} value={sup}>
              {sup}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setSearch("");
            setSupplierFilter("ALL");
            fetchData();
          }}
        >
          Refresh
        </button>
      </div>

      {/* Centered Payment Register Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Supplier Payment Register</h3>
            <p>Live disbursements synced with AP Invoices &amp; Bank Accounts</p>
          </div>
        </div>

        {loading ? (
          <p className="state-message">Loading supplier payments...</p>
        ) : error ? (
          <p className="state-message error">Error: {error}</p>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>AP Bill</th>
                <th>Supplier</th>
                <th>Bank Account</th>
                <th>Payment Date</th>
                <th>Amount Paid</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    No supplier payments recorded yet. Click{" "}
                    <strong>Record Payment</strong> to pay a bill.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.paymentID}>
                    <td>
                      <strong>PAY-{String(p.paymentID).padStart(4, "0")}</strong>
                    </td>
                    <td>BILL-{String(p.apInvoiceID).padStart(4, "0")}</td>
                    <td>
                      {p.supplier_name || `Supplier Bill #${p.apInvoiceID}`}
                    </td>
                    <td>
                      {p.bank_name
                        ? `${p.bank_name} (${p.account_number})`
                        : `Bank #${p.bankAccountID}`}
                    </td>
                    <td>{formatDate(p.paymentDate)}</td>
                    <td>
                      <strong>{formatCurrency(p.amount)}</strong>
                    </td>
                    <td>
                      <span className="status paid">Completed</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay">
          <form className="modal-box" onSubmit={handleRecordPayment}>
            <h3>Record Supplier Payment</h3>

            {/* Select Open AP Invoice */}
            <div className="modal-field">
              <label>Select Open AP Invoice *</label>
              <select
                className="modal-input"
                required
                value={selectedInvoiceId}
                onChange={(e) => handleSelectInvoice(e.target.value)}
              >
                <option value="">
                  {openInvoices.length === 0
                    ? "-- No unpaid AP invoices found --"
                    : "-- Select Unpaid Supplier Bill --"}
                </option>
                {openInvoices.map((inv) => {
                  const invId = inv.apInvoiceID ?? inv.apinvoiceid;
                  const supLabel =
                    inv.supplier_name || `Supplier #${inv.supplierID ?? "-"}`;
                  const bal =
                    inv.remainingBalance ?? inv.remainingbalance ?? inv.amount;
                  return (
                    <option key={invId} value={invId}>
                      BILL-{String(invId).padStart(4, "0")} · {supLabel} (Bal:{" "}
                      {formatCurrency(bal)})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Active Invoice Details Box */}
            {activeInvoice && (
              <div className="invoice-preview-box">
                <div className="invoice-preview-row">
                  <div>
                    <strong>Supplier:</strong>{" "}
                    {activeInvoice.supplier_name ||
                      `Supplier #${activeInvoice.supplierID}`}
                  </div>
                  <div>
                    <strong>Remaining:</strong>{" "}
                    {formatCurrency(
                      activeInvoice.remainingBalance ??
                        activeInvoice.remainingbalance ??
                        activeInvoice.amount
                    )}
                  </div>
                </div>

                <div className="split-btn-row">
                  {(() => {
                    const rem = Number(
                      activeInvoice.remainingBalance ??
                        activeInvoice.remainingbalance ??
                        activeInvoice.amount ??
                        0
                    );
                    const isFull = Number(paymentAmount) === rem;
                    const isHalf =
                      Number(paymentAmount) === Number((rem / 2).toFixed(2));
                    return (
                      <>
                        <button
                          type="button"
                          className={`split-btn full ${isFull ? "active" : ""}`}
                          onClick={() => setPaymentAmount(rem.toFixed(2))}
                        >
                          Pay Full (100%)
                        </button>
                        <button
                          type="button"
                          className={`split-btn half ${isHalf ? "active" : ""}`}
                          onClick={() =>
                            setPaymentAmount((rem / 2).toFixed(2))
                          }
                        >
                          Pay Half (50%)
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Select Bank Account */}
            <div className="modal-field">
              <label>Disbursement Bank Account *</label>
              <select
                className="modal-input"
                required
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
              >
                <option value="">
                  {bankAccounts.length === 0
                    ? "-- No bank accounts registered --"
                    : "-- Select Bank Account --"}
                </option>
                {bankAccounts.map((b) => (
                  <option key={b.bankAccountID} value={b.bankAccountID}>
                    {b.bankName} ({b.accountNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Date */}
            <div className="modal-field">
              <label>Payment Date *</label>
              <input
                type="date"
                className="modal-input"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Typable Payment Amount */}
            <div className="modal-field">
              <label>Payment Amount (Typable) *</label>
              <input
                type="text"
                inputMode="decimal"
                className="modal-input amount-input"
                required
                placeholder="Type amount e.g. 15000.00"
                value={paymentAmount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setPaymentAmount(cleaned);
                }}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
