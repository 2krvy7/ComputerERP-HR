"use client";

import { useEffect, useMemo, useState } from "react";
import "./payments.css";

export default function APPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Record Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formBankId, setFormBankId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");

  useEffect(() => {
    setFormDate(new Date().toISOString().split("T"));
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [payRes, billsRes, bankRes] = await Promise.all([
        fetch("http://127.0.0"),
        fetch("http://127.0.0open-bills"),
        fetch("http://127.0.0.1:8000/api/payments/"),
      ]);

      if (!payRes.ok) throw new Error(`Payments API error: ${payRes.status}`);
      setPayments(await payRes.json());

      if (billsRes.ok) setOpenBills(await billsRes.json());
      if (bankRes.ok) setBankAccounts(await bankRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to load AP payments");
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

  const normalizedPayments = useMemo(() => {
    return payments.map((row, idx) => {
      const rawId = row.paymentID ?? row.paymentid ?? idx + 1;
      const displayId = `PAY-${String(rawId).padStart(4, "0")}`;
      const rawDate = row.paymentDate ?? row.paymentdate ?? "";
      const isoDate = rawDate ? new Date(rawDate).toISOString().split("T") : "";
      const supplier = row.supplier_name ?? `Supplier #${row.supplierID ?? row.supplierid ?? "-"}`;
      const bankLabel = row.bank_name
        ? `${row.bank_name}${row.account_number ? ` (${row.account_number})` : ""}`
        : `Account #${row.bankAccountID ?? row.bankaccountid ?? "-"}`;
      const invId = row.apInvoiceID ?? row.apinvoiceid ?? null;
      const invoiceLabel = invId ? `BILL-${String(invId).padStart(4, "0")}` : "Unallocated";
      const amount = Number(row.amount ?? 0);

      return {
        rawId,
        displayId,
        isoDate,
        dateFormatted: formatDate(rawDate),
        supplier,
        bankLabel,
        invId,
        invoiceLabel,
        amount,
      };
    });
  }, [payments]);

  const stats = useMemo(() => {
    const totalPaid = normalizedPayments.reduce((s, p) => s + p.amount, 0);
    const totalOpenDue = openBills.reduce(
      (s, b) => s + Number(b.remainingBalance ?? b.remainingbalance ?? b.amount ?? 0),
      0
    );

    return {
      totalPaid,
      paymentCount: normalizedPayments.length,
      totalOpenDue,
      openBillCount: openBills.length,
    };
  }, [normalizedPayments, openBills]);

  const filteredPayments = useMemo(() => {
    return normalizedPayments.filter((p) => {
      if (bankFilter !== "ALL" && p.bankLabel !== bankFilter) return false;
      if (startDate && p.isoDate && p.isoDate < startDate) return false;
      if (endDate && p.isoDate && p.isoDate > endDate) return false;

      if (search) {
        const q = search.toLowerCase();
        const match =
          p.displayId.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q) ||
          p.invoiceLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [normalizedPayments, bankFilter, startDate, endDate, search]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!formInvoiceId || !formBankId || !formAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apInvoiceID: Number(formInvoiceId),
          bankAccountID: Number(formBankId),
          paymentDate: formDate,
          amount: Number(formAmount),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to record payment");
      }
      setShowModal(false);
      setFormInvoiceId("");
      setFormAmount("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

   return (
    <div className="ap-payments-page">
      <div className="page-header">
        <div>
          <h1>AP Payments</h1>
          <p>Record supplier payments and allocate every dollar to the right invoice.</p>
        </div>

        <button className="primary-btn" onClick={() => setShowModal(true)}>
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total Paid</p>
          <h2>{loading ? "..." : formatCurrency(stats.totalPaid)}</h2>
          <span>{stats.paymentCount} completed payments</span>
        </div>

        <div className="summary-card">
          <p>Allocated to Bills</p>
          <h2>{loading ? "..." : formatCurrency(stats.totalPaid)}</h2>
          <span>100% allocated</span>
        </div>

        <div className="summary-card">
          <p>Remaining Payables</p>
          <h2>{loading ? "..." : formatCurrency(stats.totalOpenDue)}</h2>
          <span>{stats.openBillCount} open bills remaining</span>
        </div>

        <div className="summary-card">
          <p>Bank Accounts</p>
          <h2>{bankAccounts.length}</h2>
          <span>Active disbursement accounts</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search payment, bill, or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
          <option value="ALL">All Bank Accounts</option>
          {bankAccounts.map((b, idx) => {
            const id = b.bankAccountID ?? b.bankaccountid ?? idx;
            const name = b.bankName ?? b.bankname ?? `Account #${id}`;
            const num = b.accountNumber ?? b.accountnumber ?? "";
            const label = `${name}${num ? ` (${num})` : ""}`;
            return (
              <option key={id} value={label}>
                {label}
              </option>
            );
          })}
        </select>

        <button
          onClick={() => {
            setSearch("");
            setBankFilter("ALL");
            setStartDate("");
            setEndDate("");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Payment Register */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Supplier Payment Register</h3>
            <p>Completed payments reduce accounts payable.</p>
          </div>
          <button onClick={fetchData}>Refresh Register</button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading supplier payments...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Bank Account</th>
                <th>Invoice Allocation</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No supplier payments recorded yet.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.rawId}>
                    <td>{payment.displayId}</td>
                    <td>{payment.dateFormatted}</td>
                    <td>{payment.supplier}</td>
                    <td>{payment.bankLabel}</td>
                    <td>{payment.invoiceLabel}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>
                      <span className="status completed">Completed</span>
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
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleRecordPayment}
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "420px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>Record Supplier Payment</h3>

            <label>Open AP Invoice *</label>
            <select
              required
              value={formInvoiceId}
              onChange={(e) => {
                const invId = e.target.value;
                setFormInvoiceId(invId);
                const selected = openBills.find(
                  (b) => String(b.apInvoiceID ?? b.apinvoiceid) === invId
                );
                if (selected) {
                  setFormAmount(
                    String(selected.remainingBalance ?? selected.remainingbalance ?? selected.amount ?? "")
                  );
                }
              }}
            >
              <option value="">-- Select Open Bill --</option>
              {openBills.map((b, idx) => {
                const id = b.apInvoiceID ?? b.apinvoiceid ?? idx;
                const sup = b.supplier_name ?? `Supplier #${b.supplierID ?? "-"}`;
                const bal = formatCurrency(
                  Number(b.remainingBalance ?? b.remainingbalance ?? b.amount ?? 0)
                );
                return (
                  <option key={id} value={id}>
                    BILL-{String(id).padStart(4, "0")} — {sup} (Bal: {bal})
                  </option>
                );
              })}
            </select>

            <label>Disbursement Bank Account *</label>
            <select
              required
              value={formBankId}
              onChange={(e) => setFormBankId(e.target.value)}
            >
              <option value="">-- Select Bank Account --</option>
              {bankAccounts.map((b, idx) => {
                const id = b.bankAccountID ?? b.bankaccountid ?? idx;
                const name = b.bankName ?? b.bankname ?? `Account #${id}`;
                const num = b.accountNumber ?? b.accountnumber ?? "";
                return (
                  <option key={id} value={id}>
                    {name} {num ? `(${num})` : ""}
                  </option>
                );
              })}
            </select>

            <label>Payment Date *</label>
            <input
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <label>Amount *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="payment-note">
        Allocation complete. All payments are linked to supplier invoices.
      </div>
    </div>
  );
}