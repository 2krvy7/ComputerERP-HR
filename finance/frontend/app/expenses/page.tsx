"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./expenses.css";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [productions, setProductions] = useState<any[]>([]);
  const [payrollTotal, setPayrollTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs, Filters & Approvals
  const [activeTab, setActiveTab] = useState<"ALL" | "Pending" | "Approved" | "Posted">("ALL");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Add Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formAccountId, setFormAccountId] = useState("");
  const [formProductionId, setFormProductionId] = useState("");
  const [formPostingId, setFormPostingId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formDescription, setFormDescription] = useState("");


  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [expRes, optRes] = await Promise.all([

        // FETCH 1: GET http://127.0.0.1:8000/api/expense/
        // Backend File: finance/backend/routers/expense.py -> get_expenses()
        // Database Tables: Auto-syncs Team 3 "PRODUCTION" & Team 6 "Payroll", then reads "Expense" joined with "ChartOfAccounts" & "ProductionOrder"
        // Purpose: Loads all recorded production and operating expenses for the main table
        fetch("http://127.0.0.1:8000/api/expense/"),

        // FETCH 2: GET http://127.0.0
        // Backend File: finance/backend/routers/expense.py -> get_expense_options()
        // Database Tables: Reads "ChartOfAccounts", "ProductionOrder", and sums "PayrollExpense"
        // Purpose: Populates modal dropdowns and displays the total HR Payroll card
        fetch("http://127.0.0.1:8000/api/expense/options"),
      ]);

      if (!expRes.ok) throw new Error(`Expense API error: ${expRes.status}`);
      const expJson = await expRes.json();
      setExpenses(Array.isArray(expJson) ? expJson : []);

      if (optRes.ok) {
        const optJson = await optRes.json();
        setAccounts(Array.isArray(optJson.accounts) ? optJson.accounts : []);
        setProductions(Array.isArray(optJson.productions) ? optJson.productions : []);
        setPayrollTotal(Number(optJson.payrollTotal || 0));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const normalizedExpenses = useMemo(() => {
    return expenses.map((row, idx) => {
      const id = Number(row.expenseID ?? row.expenseid ?? idx + 1);
      const displayId = `EXP-${String(id).padStart(4, "0")}`;
      const prodId = row.productionID ?? row.productionid ?? "-";
      const postingId = row.postingID ?? row.postingid ?? null;
      const category = row.account_name
        ? `${row.account_code ? `${row.account_code} - ` : ""}${row.account_name}`
        : `Account #${row.accountID ?? row.accountid ?? "-"}`;
      const amount = Number(row.amount ?? 0);

      let approval = "Pending";
      if (postingId) approval = "Posted";
      else if (approvedIds.includes(id)) approval = "Approved";

      return {
        id,
        displayId,
        reference: `Production Order #${prodId}`,
        category,
        amount,
        postingLabel: postingId ? `JE-${String(postingId).padStart(4, "0")}` : "Not Posted",
        approval,
        sourceType: prodId !== "-" ? "Production Cost" : "Operating Expense",
      };
    });
  }, [expenses, approvedIds]);

  const stats = useMemo(() => {
    const expenseSum = normalizedExpenses.reduce((s, e) => s + e.amount, 0);
    const totalRecorded = expenseSum + payrollTotal;
    const pendingRows = normalizedExpenses.filter((e) => e.approval === "Pending");
    const approvedRows = normalizedExpenses.filter((e) => e.approval === "Approved");

    return {
      totalRecorded,
      expenseSum,
      expenseCount: normalizedExpenses.length,
      pendingTotal: pendingRows.reduce((s, e) => s + e.amount, 0),
      pendingCount: pendingRows.length,
      approvedTotal: approvedRows.reduce((s, e) => s + e.amount, 0),
      approvedCount: approvedRows.length,
      payrollTotal,
    };
  }, [normalizedExpenses, payrollTotal]);

  const filteredExpenses = useMemo(() => {
    return normalizedExpenses.filter((item) => {
      if (activeTab !== "ALL" && item.approval !== activeTab) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const match =
          item.displayId.toLowerCase().includes(q) ||
          item.reference.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [normalizedExpenses, activeTab, categoryFilter, search]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleApproveSelected() {
    if (selectedIds.length === 0) {
      alert("Select at least one expense checkbox first.");
      return;
    }
    setApprovedIds((prev) => Array.from(new Set([...prev, ...selectedIds])));
    setSelectedIds([]);
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!formAccountId || !formProductionId || !formAmount) return;

    setSubmitting(true);
    try {
      // FETCH: POST http://127.0.0
      // Backend File: finance/backend/routers/expense.py -> create_expense()
      // Database Tables: Inserts into "Expense" and auto-posts description + debit/credit lines to "JournalEntry", "JournalEntryLine", & "GeneralLedger"
      // Purpose: Saves the expense, records its description in Journal Entries, and auto-links postingID
      const res = await fetch("http://127.0.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountID: Number(formAccountId),
          productionID: formProductionId ? Number(formProductionId) : null,
          description: formDescription.trim(),
          amount: Number(formAmount),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save expense");
      }

      setShowAddModal(false);
      setFormAccountId("");
      setFormDescription("");
      setFormProductionId("");
      setFormAmount("");
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Error creating expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="expenses-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>
            Capture production and operating costs, review claims and keep business spending organized.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light" onClick={() => window.print()}>
            Export
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            Add expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total recorded costs</p>
          <h2>{loading ? "..." : formatCurrency(stats.totalRecorded)}</h2>
          <span>Includes {formatCurrency(stats.payrollTotal)} payroll</span>
        </div>

        <div className="summary-card">
          <p>Production & OpEx</p>
          <h2>{loading ? "..." : formatCurrency(stats.expenseSum)}</h2>
          <span>
            {stats.expenseCount} {stats.expenseCount === 1 ? "item" : "items"} recorded
          </span>
        </div>

        <div className="summary-card">
          <p>Awaiting approval</p>
          <h2>{loading ? "..." : formatCurrency(stats.pendingTotal)}</h2>
          <span>
            {stats.pendingCount} {stats.pendingCount === 1 ? "item" : "items"} - Not yet posted
          </span>
        </div>

        <div className="summary-card">
          <p>Approved for posting</p>
          <h2>{loading ? "..." : formatCurrency(stats.approvedTotal)}</h2>
          <span>
            {stats.approvedCount} approved {stats.approvedCount === 1 ? "expense" : "expenses"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(
          [
            { key: "ALL", label: "All expenses" },
            { key: "Pending", label: "Pending approval" },
            { key: "Approved", label: "Approved" },
            { key: "Posted", label: "Posted" },
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
      <div className="filters">
        <input
          type="text"
          placeholder="Search expense, production order, or account..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">All categories</option>
          {Array.from(new Set(normalizedExpenses.map((e) => e.category))).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <button
          className="btn-light"
          onClick={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setActiveTab("ALL");
          }}
        >
          Reset filters
        </button>
      </div>

       {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Expense register</h3>
            <p>Linked to Chart of Accounts and Production Orders.</p>
          </div>

          <button className="btn-light" onClick={handleApproveSelected}>
            Approve selected ({selectedIds.length})
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading expenses...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Expense ID</th>
                <th>Reference</th>
                <th>Account Category</th>
                <th>Amount</th>
                <th>Journal Posting</th>
                <th>Approval</th>
                <th>Source</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td>{item.displayId}</td>
                    <td>{item.reference}</td>
                    <td>{item.category}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{item.postingLabel}</td>
                    <td>
                      <span className={`badge ${item.approval.toLowerCase()}`}>
                        {item.approval}
                      </span>
                    </td>
                    <td>{item.sourceType}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

     {/* Add Expense Modal */}
      {showAddModal && (
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
            onSubmit={handleCreateExpense}
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "430px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3>Add Expense</h3>

            <label>Expense Account (Chart of Accounts) *</label>
            <select
              required
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
            >
              <option value="">-- Select Account --</option>
              {accounts.map((acc, idx) => {
                const id = acc.accountID ?? acc.accountid ?? idx;
                const code = acc.accountCode ?? acc.accountcode ?? "";
                const name =
                  acc.accountName ?? acc.accountname ?? `Account #${id}`;
                return (
                  <option key={id} value={id}>
                    {code ? `${code} - ` : ""}
                    {name}
                  </option>
                );
              })}
            </select>

            <label>Description (Auto-posted to Journal Entries) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Meralco Electricity Bill or Office Supplies"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />

            <label>Production Order (Optional — Leave blank for Overhead)</label>
            {productions.length > 0 ? (
              <select
                value={formProductionId}
                onChange={(e) => setFormProductionId(e.target.value)}
              >
                <option value="">
                  -- None (General Operating / Overhead Expense) --
                </option>
                {productions.map((p, idx) => {
                  const id = p.productionID ?? p.productionid ?? idx;
                  const prod = p.productID ?? p.productid ?? "-";
                  return (
                    <option key={id} value={id}>
                      Production #{id} (Product #{prod})
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="number"
                placeholder="Optional: Production Order ID (leave blank for overhead)"
                value={formProductionId}
                onChange={(e) => setFormProductionId(e.target.value)}
              />
            )}

            <label>Amount *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <p style={{ fontSize: "0.8rem", color: "#4b5563", margin: 0 }}>
              Note: Journal Entry &amp; General Ledger posting are generated
              automatically when you save.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <button type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}