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

  // Record Payment Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [payRes, optRes, invRes, bankRes] = await Promise.all([
        // FETCH 1: GET http://127.0.0
        // Backend File: finance/backend/routers/payments.py -> get_payments()
        // Database Tables: Reads "APPayment" joined with "APInvoice", "Supplier", and "BankAccount"
        // Purpose: Loads all recorded supplier disbursements for the main register table
        fetch("http://127.0.0.1:8000/api/payments"),

        // FETCH 2: GET http://127.0.0options
        // Backend File: finance/backend/routers/payments.py -> get_payment_options()
        // Database Tables: Reads unpaid "APInvoice" rows and registered "BankAccount" rows
        // Purpose: Populates the Record Payment modal dropdowns
        fetch("http://127.0.0.1:8000/api/payments/options"),

        // FETCH 3 (Fallback Invoices): GET http://127.0.0
        // Backend File: finance/backend/routers/apinvoices.py -> get_ap_invoices()
        // Database Tables: Reads "APInvoice" joined with "Supplier"
        // Purpose: Ensures open AP invoices still load if /options returns empty
        fetch("http://127.0.0.1:8000/api/apinvoices"),

        // FETCH 4 (Fallback Bank Accounts): GET http://127.0.0
        // Backend File: finance/backend/routers/bank.py -> get_bank_accounts()
        // Database Tables: Reads "BankAccount" with active disbursement status
        // Purpose: Ensures active disbursement bank accounts always appear in the dropdown
        fetch("http://127.0.0.1:8000/api/bank"),
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

      // Fallback to direct AP Invoices endpoint if options returned empty
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

      // Fallback to direct Bank Accounts endpoint if options returned empty
      if (loadedBanks.length === 0 && bankRes.ok) {
        const allBanks = await bankRes.json();
        loadedBanks = Array.isArray(allBanks) ? allBanks : [];
      }

      setOpenInvoices(loadedInvoices);
      setBankAccounts(loadedBanks);
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

  // Find currently selected invoice object so we can show remaining balance
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
      // Pre-fill with remaining balance while keeping the input completely typable
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
      // FETCH 5: POST http://127.0.0
      // Backend File: finance/backend/routers/payments.py -> create_payment()
      // Database Tables: Inserts into "APPayment" and updates "APInvoice" (totalPaid, remainingBalance, status)
      // Purpose: Records supplier payment and deducts cash outflow from the chosen BankAccount
      const res = await fetch("http://127.0.0.1:8000/api/payments", {
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

  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      const payId = `pay-${String(p.paymentID).padStart(4, "0")}`;
      const billId = `bill-${String(p.apInvoiceID).padStart(4, "0")}`;
      const supplier = String(p.supplier_name || "").toLowerCase();
      const bank = String(p.bank_name || "").toLowerCase();
      return (
        payId.includes(q) ||
        billId.includes(q) ||
        supplier.includes(q) ||
        bank.includes(q)
      );
    });
  }, [payments, search]);

  return (
    <div className="payments-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>AP Payments</h1>
          <p>
            Disburse supplier payments, track bank outflows, and settle open
            bills.
          </p>
        </div>

        <button
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

      {/* Search & Refresh */}
      <div
        className="filter-bar"
        style={{ margin: "1rem 0", display: "flex", gap: "0.75rem" }}
      >
        <input
          type="text"
          placeholder="Search payment ID, bill, supplier, or bank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          }}
        />
        <button className="secondary-btn" onClick={fetchData}>
          Refresh
        </button>
      </div>

      {/* Payment Register Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Supplier Payment Register</h3>
            <p>Live disbursements synced with AP Invoices &amp; Bank Accounts</p>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading supplier payments...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : (
          <table>
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
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No supplier payments recorded yet. Click{" "}
                    <strong>Record Payment</strong> to pay a bill.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.paymentID}>
                    <td>PAY-{String(p.paymentID).padStart(4, "0")}</td>
                    <td>BILL-{String(p.apInvoiceID).padStart(4, "0")}</td>
                    <td>{p.supplier_name || `Supplier Bill #${p.apInvoiceID}`}</td>
                    <td>
                      {p.bank_name
                        ? `${p.bank_name} (${p.account_number})`
                        : `Bank #${p.bankAccountID}`}
                    </td>
                    <td>{formatDate(p.paymentDate)}</td>
                    <td>{formatCurrency(p.amount)}</td>
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
            onSubmit={handleRecordPayment}
            style={{
              backgroundColor: "#ffffff",
              padding: "1.5rem",
              borderRadius: "10px",
              width: "440px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3 style={{ margin: 0 }}>Record Supplier Payment</h3>

            {/* Select Open AP Invoice */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Select Open AP Invoice *</label>
              <select
                required
                value={selectedInvoiceId}
                onChange={(e) => handleSelectInvoice(e.target.value)}
                style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #ccc" }}
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
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.85rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div>
                    <strong>Supplier:</strong>{" "}
                    {activeInvoice.supplier_name ||
                      `Supplier #${activeInvoice.supplierID}`}
                  </div>
                  <div>
                    <strong>Remaining Balance:</strong>{" "}
                    {formatCurrency(
                      activeInvoice.remainingBalance ??
                        activeInvoice.remainingbalance ??
                        activeInvoice.amount
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentAmount(
                      String(
                        activeInvoice.remainingBalance ??
                          activeInvoice.remainingbalance ??
                          activeInvoice.amount
                      )
                    )
                  }
                  style={{
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.78rem",
                    borderRadius: "4px",
                    border: "1px solid #2563eb",
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    cursor: "pointer",
                  }}
                >
                  Pay Full
                </button>
              </div>
            )}

            {/* Select Bank Account */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Disbursement Bank Account *</label>
              <select
                required
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #ccc" }}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Payment Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            {/* Typable Payment Amount */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label>Payment Amount (Typable) *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="Type amount e.g. 15000.00"
                value={paymentAmount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setPaymentAmount(cleaned);
                }}
                style={{
                  padding: "0.55rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  fontWeight: 600,
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
                onClick={() => setShowModal(false)}
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
                {submitting ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}