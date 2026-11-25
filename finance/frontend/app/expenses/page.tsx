"use client";

import { useEffect, useMemo, useState } from "react";
import "./expenses.css";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [productions, setProductions] = useState<any[]>([]);
  const [payrollTotal, setPayrollTotal] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");

  // Multi-Select Checkboxes (Unique keys so check & uncheck always toggle cleanly)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkSelectAction, setBulkSelectAction] = useState("");
  const [approving, setApproving] = useState(false);

  // Add Expense Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [formAccountId, setFormAccountId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProductionId, setFormProductionId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");


  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [expRes, optRes] = await Promise.all([
        // FETCH 1: GET http://127.0.0
        fetch(`${API_URL}/api/expense`),
        // FETCH 2: GET http://127.0.0options
        fetch(`${API_URL}/api/expense/options`),
      ]);

      if (!expRes.ok) throw new Error(`Expenses API error: ${expRes.status}`);
      const expJson = await expRes.json();
      setExpenses(Array.isArray(expJson) ? expJson : []);

      if (optRes.ok) {
        const optJson = await optRes.json();
        setAccounts(Array.isArray(optJson.accounts) ? optJson.accounts : []);
        setProductions(
          Array.isArray(optJson.productions) ? optJson.productions : []
        );
        setPayrollTotal(Number(optJson.payrollTotal || 0));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);


  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));


  const normalizedExpenses = useMemo(() => {
    return expenses.map((e, idx) => {
      const isPayroll =
        e.source_type === "Payroll" ||
        String(e.expenseID || "").startsWith("PR-");
      const isProductionOrder =
        e.source_type === "ProductionOrder" ||
        String(e.expenseID || "").startsWith("PO-");

      const rawId = isPayroll
        ? Number(
            e.payrollExpenseID ??
              String(e.expenseID).replace("PR-", "") ??
              idx + 1
          )
        : isProductionOrder
        ? Number(
            e.productionOrderID ??
              String(e.expenseID).replace("PO-", "") ??
              idx + 1
          )
        : Number(e.expenseID ?? idx + 1);

      const rowKey = isPayroll
        ? `PR-${rawId}`
        : isProductionOrder
        ? `PO-${rawId}`
        : `EXP-${rawId}`;
      const isPosted = e.postingID != null;

      return {
        ...e,
        rowKey,
        rawId,
        isPayroll,
        isProductionOrder,
        isProduction: !isPayroll && (isProductionOrder || e.productionID != null),
        isPosted,
      };
    });
  }, [expenses]);

   const stats = useMemo(() => {
    // 1. Operating & Production Expenses: includes Direct Overhead, Approved Production, AND Approved HR Payroll
    const approvedOperatingAndProd = normalizedExpenses
      .filter((e) => !e.isPayroll || e.isPosted)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // 2. Unapproved (Pending) HR Payroll runs not yet added into Operating & Production Expenses
    const pendingPayroll = normalizedExpenses
      .filter((e) => e.isPayroll && !e.isPosted)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const postedCount = normalizedExpenses.filter((e) => e.isPosted).length;
    const unpostedCount = normalizedExpenses.filter((e) => !e.isPosted).length;

    return {
      directExpenses: approvedOperatingAndProd,
      payrollTotal,
      combinedTotal: approvedOperatingAndProd + pendingPayroll,
      postedCount,
      unpostedCount,
    };
  }, [normalizedExpenses, payrollTotal]);

  const filteredExpenses = useMemo(() => {
    return normalizedExpenses.filter((e) => {
      if (
        accountFilter !== "ALL" &&
        String(e.accountID) !== String(accountFilter)
      ) {
        return false;
      }
      const q = search.toLowerCase();
      return (
        e.rowKey.toLowerCase().includes(q) ||
        String(e.account_name || "").toLowerCase().includes(q) ||
        String(e.account_code || "").toLowerCase().includes(q) ||
        String(e.description || "").toLowerCase().includes(q)
      );
    });
  }, [normalizedExpenses, search, accountFilter]);

  function toggleSelectRow(rowKey: string) {
    setSelectedKeys((prev) =>
      prev.includes(rowKey)
        ? prev.filter((k) => k !== rowKey)
        : [...prev, rowKey]
    );
  }

  function handleBulkDropdownChange(action: string) {
    setBulkSelectAction(action);
    if (action === "ALL_PRODUCTION") {
      setSelectedKeys(
        filteredExpenses
          .filter((e) => !e.isPosted && e.isProduction)
          .map((e) => e.rowKey)
      );
    } else if (action === "ALL_PAYROLL") {
      setSelectedKeys(
        filteredExpenses
          .filter((e) => !e.isPosted && e.isPayroll)
          .map((e) => e.rowKey)
      );
    } else if (action === "ALL_PENDING") {
      setSelectedKeys(
        filteredExpenses.filter((e) => !e.isPosted).map((e) => e.rowKey)
      );
    } else if (action === "CLEAR") {
      setSelectedKeys([]);
    }
  }

  async function handleBatchApprove() {
    if (selectedKeys.length === 0) return;

    const expenseIds = selectedKeys
      .filter((k) => k.startsWith("EXP-"))
      .map((k) => Number(k.replace("EXP-", "")));
    const payrollIds = selectedKeys
      .filter((k) => k.startsWith("PR-"))
      .map((k) => Number(k.replace("PR-", "")));
    const productionOrderIds = selectedKeys
      .filter((k) => k.startsWith("PO-"))
      .map((k) => Number(k.replace("PO-", "")));

    setApproving(true);
    try {
      // FETCH 3: POST http://127.0.0.1:8000/api/expense/batch-approve
      // Backend File: finance/backend/routers/expense.py -> batch_approve_expenses()
      // Purpose: Approves ProductionOrder (PO-#) & Expense (EXP-#) to Journal Entries, and transfers Payroll (PR-#) to BPI Payroll
      const res = await fetch(`${API_URL}/api/expense/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds,
          payrollIds,
          productionOrderIds,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Batch approval failed");
      }

      const result = await res.json();
      alert(result.message || "Approved and posted to Journal Entries!");
      setSelectedKeys([]);
      setBulkSelectAction("");
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Error approving expenses");
    } finally {
      setApproving(false);
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!formAccountId || !formDescription.trim() || Number(formAmount) <= 0) {
    alert("Please fill in Account, Description, and Amount.");
    return;
  }

  setSubmitting(true);
  try {

    // EXACT FETCH PATH: POST http://127.0.0
      // FRONTEND FILE: finance/frontend/app/expenses/page.tsx -> handleCreateExpense()
      // BACKEND ROUTE: finance/backend/routers/expense.py -> create_expense()
    const res = await fetch("http://127.0.0.1:8000/api/expense", {
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
    alert(err.message);
  } finally {
    setSubmitting(false);
  }
}


  const pendingFiltered = filteredExpenses.filter((e) => !e.isPosted);
  const allPendingChecked =
    pendingFiltered.length > 0 &&
    pendingFiltered.every((e) => selectedKeys.includes(e.rowKey));

  return (
    <div className="expenses-page">
      <div className="page-header">
        <div>
          <h1>Expenses &amp; Production Costing</h1>
          <p>
            Approve production costs for ledger posting, release HR payroll to BPI Payroll, and record direct expenses.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={fetchData}>
            Sync &amp; Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            Add Expense
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span>Operating &amp; Production Expenses</span>
          <h2>{loading ? "..." : formatCurrency(stats.directExpenses)}</h2>
          <small>Production &amp; overhead items</small>
        </div>

        <div className="summary-card">
          <span>HR Payroll Expenses</span>
          <h2>{loading ? "..." : formatCurrency(stats.payrollTotal)}</h2>
          <small>Disbursed directly to BPI Payroll</small>
        </div>

        <div className="summary-card">
          <span>Combined Total Outflow</span>
          <h2>{loading ? "..." : formatCurrency(stats.combinedTotal)}</h2>
          <small>Expenses + Payroll combined</small>
        </div>

        <div className="summary-card">
          <span>Journal Posting Status</span>
          <h2>
            {loading ? "..." : `${stats.postedCount} / ${normalizedExpenses.length}`}
          </h2>
          <small>
            {stats.unpostedCount === 0
              ? "All expenses posted to ledger"
              : `${stats.unpostedCount} awaiting approval`}
          </small>
        </div>
      </div>

      <div
        className="filter-bar"
        style={{ margin: "1rem 0", display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="text"
          placeholder="Search ID, description, or account..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: "200px",
            padding: "0.55rem 0.75rem",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          }}
        />

        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
          }}
        >
          <option value="ALL">All Accounts ({accounts.length})</option>
          {accounts.map((acc, idx) => {
            const id = acc.accountID ?? acc.accountid ?? idx;
            const code = acc.accountCode ?? acc.accountcode ?? "";
            const name = acc.accountName ?? acc.accountname ?? `Account #${id}`;
            return (
              <option key={id} value={id}>
                {code ? `${code} - ` : ""}{name}
              </option>
            );
          })}
        </select>

        <select
          value={bulkSelectAction}
          onChange={(e) => handleBulkDropdownChange(e.target.value)}
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "6px",
            border: "1px solid #93c5fd",
            backgroundColor: "#eff6ff",
            color: "#1e40af",
            fontWeight: 500,
          }}
        >
          <option value="">-- Select Category to Check --</option>
          <option value="ALL_PRODUCTION">Check All Pending Production</option>
          <option value="ALL_PAYROLL">Check All Pending Payroll</option>
          <option value="ALL_PENDING">Check All Pending Items</option>
          <option value="CLEAR">Uncheck All</option>
        </select>

        {selectedKeys.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            disabled={approving}
            onClick={handleBatchApprove}
            style={{ backgroundColor: "#16a34a" }}
          >
            {approving ? "Posting..." : `Approve & Post Selected (${selectedKeys.length})`}
          </button>
        )}
      </div>

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Expense Register</h3>
            <p>Check pending items to approve for Journal Posting or Payroll Transfer</p>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading expenses...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={allPendingChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedKeys(pendingFiltered.map((x) => x.rowKey));
                      } else {
                        setSelectedKeys([]);
                      }
                    }}
                  />
                </th>
                <th>Expense ID</th>
                <th>Account</th>
                <th>Description</th>
                <th>Category</th>
                <th>Journal Posting</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isChecked = selectedKeys.includes(exp.rowKey);
                  return (
                    <tr
                      key={exp.rowKey}
                      style={{ backgroundColor: isChecked ? "#f0fdf4" : undefined }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          disabled={exp.isPosted}
                          checked={isChecked}
                          onChange={() => toggleSelectRow(exp.rowKey)}
                        />
                      </td>
                      <td><strong>{exp.rowKey}</strong></td>
                      <td>
                        {exp.account_code ? `${exp.account_code} - ` : ""}
                        {exp.account_name || `Account #${exp.accountID}`}
                      </td>
                      <td>
                        {exp.description ||
                          (exp.productionID
                            ? `Production Batch #${exp.productionID} Cost`
                            : "Operating Expense")}
                      </td>
                      <td>
                        {exp.isPayroll ? (
                          <span className="badge">HR Payroll → BPI Payroll</span>
                        ) : exp.isProduction ? (
                          <span>Production #{exp.productionID}</span>
                        ) : (
                          <span style={{ color: "#6b7280" }}>Direct Overhead</span>
                        )}
                      </td>
                      <td>
                        {exp.isPosted ? (
                          <span className="status posted">
                            {exp.reference_no || `JE-${String(exp.postingID).padStart(4, "0")}`}
                          </span>
                        ) : (
                          <span className="status pending">Pending Approval</span>
                        )}
                      </td>
                      <td><strong>{formatCurrency(exp.amount)}</strong></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

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
            <h3>Add Direct Expense</h3>

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
                const name = acc.accountName ?? acc.accountname ?? `Account #${id}`;
                return (
                  <option key={id} value={id}>
                    {code ? `${code} - ` : ""}{name}
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
              Note: Saving automatically marks this expense paid and posts it
              directly to Journal Entries &amp; General Ledger.
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
                {submitting ? "Saving..." : "Save & Post Expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

