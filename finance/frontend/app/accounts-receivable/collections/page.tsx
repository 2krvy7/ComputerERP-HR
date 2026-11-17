"use client";

import { useEffect, useMemo, useState } from "react";
import "./collections.css";

export default function Collections() {
  const [worklist, setWorklist] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"ALL" | "High" | "Overdue" | "Upcoming">("ALL");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Record Receipt Modal State
  const [collectingRow, setCollectingRow] = useState<any | null>(null);
  const [formBankId, setFormBankId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setTodayStr(today);
    setFormDate(today);
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [listRes, bankRes] = await Promise.all([
        fetch("http://127.0.0"),
        fetch("http://127.0.0bank-accounts"),
      ]);

      if (!listRes.ok) throw new Error(`Collections API error: ${listRes.status}`);
      setWorklist(await listRes.json());

      if (bankRes.ok) setBankAccounts(await bankRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to load collections worklist");
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
    });
  };

  const normalizedRows = useMemo(() => {
    return worklist.map((row, idx) => {
      const rawId = row.arInvoiceID ?? row.arinvoiceid ?? row.id ?? idx + 1;
      const invoice = `INV-${String(rawId).padStart(4, "0")}`;
      const custId = row.customerID ?? row.customerid ?? "";
      const customer = row.customer_name ?? row.customerName ?? (custId ? `Customer #${custId}` : "Walk-in Customer");
      const dueDateRaw = row.dueDate ?? row.duedate ?? "";
      const isoDue = dueDateRaw ? new Date(dueDateRaw).toISOString().split("T")[0] : "";
      const outstanding = Number(row.remainingBalance ?? row.remainingbalance ?? row.amount ?? 0);

      const isOverdue = Boolean(todayStr && isoDue && isoDue < todayStr);
      const overdue = isOverdue ? outstanding : 0;

      // Priority scoring based on overdue status and balance
      let priority = "Low";
      if (isOverdue && outstanding >= 2000) priority = "High";
      else if (isOverdue || outstanding >= 5000) priority = "Medium";

      const status = isOverdue ? "Overdue" : row.status ?? "Sent";
      const nextActivity = isOverdue
        ? `Follow-up Call • Due ${formatDate(dueDateRaw)}`
        : `Scheduled Due • ${formatDate(dueDateRaw)}`;

      return {
        rawId,
        invoice,
        customer,
        outstanding,
        overdue,
        isOverdue,
        priority,
        status,
        nextActivity,
      };
    });
  }, [worklist, todayStr]);

  const stats = useMemo(() => {
    const outstandingTotal = normalizedRows.reduce((s, r) => s + r.outstanding, 0);
    const overdueTotal = normalizedRows.reduce((s, r) => s + r.overdue, 0);
    const highPriorityRows = normalizedRows.filter((r) => r.priority === "High");
    const highPriorityTotal = highPriorityRows.reduce((s, r) => s + r.outstanding, 0);
    const upcomingRows = normalizedRows.filter((r) => !r.isOverdue);
    const upcomingTotal = upcomingRows.reduce((s, r) => s + r.outstanding, 0);

    const uniqueCustomers = new Set(normalizedRows.map((r) => r.customer)).size;
    const overduePct = outstandingTotal > 0 ? ((overdueTotal / outstandingTotal) * 100).toFixed(1) : "0.0";

    return {
      outstandingTotal,
      uniqueCustomers,
      invoiceCount: normalizedRows.length,
      overdueTotal,
      overduePct,
      highPriorityTotal,
      highPriorityCount: highPriorityRows.length,
      upcomingTotal,
      upcomingCount: upcomingRows.length,
    };
  }, [normalizedRows]);

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((row) => {
      if (activeTab === "High" && row.priority !== "High") return false;
      if (activeTab === "Overdue" && !row.isOverdue) return false;
      if (activeTab === "Upcoming" && row.isOverdue) return false;

      if (priorityFilter !== "ALL" && row.priority !== priorityFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !row.customer.toLowerCase().includes(q) &&
          !row.invoice.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [normalizedRows, activeTab, priorityFilter, search]);

  function openCollectModal(row: any) {
    setCollectingRow(row);
    setFormAmount(String(row.outstanding));
  }

  async function handleRecordReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!collectingRow || !formBankId || !formAmount) return;

    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arInvoiceID: collectingRow.rawId,
          bankAccountID: Number(formBankId),
          paymentDate: formDate,
          amount: Number(formAmount),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to record collection receipt");
      }
      setCollectingRow(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="collections-page">
      <div className="page-header">
        <div>
          <h1>Collections</h1>
          <p>
            Prioritize overdue customers, send reminders and record customer receipts.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => alert("Collection reminders queued for overdue accounts.")}
        >
          Send Reminders
        </button>
      </div>

      {/* Metrics */}
      <div className="summary-grid">
        <div className="summary-card">
          <span>Outstanding Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.outstandingTotal)}</h2>
          <small>
            {stats.uniqueCustomers} {stats.uniqueCustomers === 1 ? "customer" : "customers"} • {stats.invoiceCount}{" "}
            {stats.invoiceCount === 1 ? "invoice" : "invoices"}
          </small>
        </div>

        <div className="summary-card">
          <span>Overdue Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.overdueTotal)}</h2>
          <small className={stats.overdueTotal > 0 ? "warning" : ""}>
            {stats.overduePct}% of receivables
          </small>
        </div>

        <div className="summary-card">
          <span>High Priority Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.highPriorityTotal)}</h2>
          <small className={stats.highPriorityCount > 0 ? "warning" : ""}>
            {stats.highPriorityCount} {stats.highPriorityCount === 1 ? "invoice" : "invoices"} needing urgent follow-up
          </small>
        </div>

        <div className="summary-card">
          <span>Upcoming Due</span>
          <h2>{loading ? "..." : formatCurrency(stats.upcomingTotal)}</h2>
          <small className="success">
            {stats.upcomingCount} {stats.upcomingCount === 1 ? "invoice" : "invoices"} not yet due
          </small>
        </div>
      </div>

      {/* Tabs */}
      <div className="collections-tabs">
        {(
          [
            { key: "ALL", label: "All Customers" },
            { key: "High", label: "High Priority" },
            { key: "Overdue", label: "Overdue" },
            { key: "Upcoming", label: "Upcoming Due" },
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
          placeholder="Search customer or invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="ALL">All Priorities</option>
          <option value="High">High Priority</option>
          <option value="Medium">Medium Priority</option>
          <option value="Low">Low Priority</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setPriorityFilter("ALL");
            setActiveTab("ALL");
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Worklist */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Collection Worklist</h3>
            <p>Prioritized by due date and outstanding balance</p>
          </div>

          <button className="secondary-btn" onClick={fetchData}>
            Refresh Worklist
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading collections worklist...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Outstanding</th>
                <th>Overdue</th>
                <th>Priority</th>
                <th>Follow-up Status</th>
                <th>Next Activity</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No open receivables in collections worklist.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.rawId}>
                    <td>
                      <strong>{row.customer}</strong>
                      <p>{row.invoice}</p>
                    </td>

                    <td>{formatCurrency(row.outstanding)}</td>

                    <td>{formatCurrency(row.overdue)}</td>

                    <td>
                      <span className={`priority ${row.priority.toLowerCase()}`}>
                        {row.priority}
                      </span>
                    </td>

                    <td>
                      <span className="status">{row.status}</span>
                    </td>

                    <td>{row.nextActivity}</td>

                    <td>
                      <button
                        className="link-btn"
                        onClick={() => openCollectModal(row)}
                      >
                        Record Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Receipt Modal */}
      {collectingRow && (
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
            onSubmit={handleRecordReceipt}
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
            <h3>Record Customer Receipt</h3>
            <p>
              <strong>{collectingRow.customer}</strong> — {collectingRow.invoice}
            </p>

            <label>Deposit Bank Account *</label>
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

            <label>Receipt Date *</label>
            <input
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <label>Amount Collected *</label>
            <input
              type="number"
              step="0.01"
              required
              max={collectingRow.outstanding}
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => setCollectingRow(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Confirm Receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="collection-note">
        Recording a receipt automatically deposits funds into your selected Bank Account and reduces the customer's remaining AR balance.
      </div>
    </div>
  );
}