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

  // Interactive Selection Mode (Revealed when tapping "Select" on Expense Register)
  const [isSelecting, setIsSelecting] = useState(false);
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
        // FETCH 1: GET ${API_URL}/api/expense
        fetch(`${API_URL}/api/expense`),
        // FETCH 2: GET ${API_URL}/api/expense/options
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

  // Philippine Peso (PHP) currency formatter
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val || 0));

      // Normalize expenses & sort newest register entries on top (rawId DESC)
  const normalizedExpenses = useMemo(() => {
    return expenses
      .map((e, idx) => {
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
          isProduction:
            !isPayroll && (isProductionOrder || e.productionID != null),
          isPosted,
        };
      })
      .sort((a, b) => {
        const timeA = a.expenseDate || a.createdAt ? new Date(a.expenseDate ?? a.createdAt).getTime() : 0;
        const timeB = b.expenseDate || b.createdAt ? new Date(b.expenseDate ?? b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.rawId - a.rawId;
      });
  }, [expenses]);

  const stats = useMemo(() => {
    const approvedOperatingAndProd = normalizedExpenses
      .filter((e) => !e.isPayroll || e.isPosted)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

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

  function toggleSelectMode() {
    if (isSelecting) {
      setIsSelecting(false);
      setSelectedKeys([]);
      setBulkSelectAction("");
    } else {
      setIsSelecting(true);
    }
  }

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
    if (selectedKeys.length === 0) {
      alert("Please check at least one pending item to pay/approve.");
      return;
    }

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
      // FETCH 3: POST ${API_URL}/api/expense/batch-approve
      // Backend File: finance/backend/routers/expense.py -> batch_approve_expenses()
      // Purpose: Approves ProductionOrder & Expense to Journal Entries, releases HR Payroll to BPI Payroll, and marks HR Payroll status as Paid
      const res = await fetch(`${API_URL}/api/expense/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds,
          payrollIds,
          productionOrderIds,
          payrollStatus: "Paid",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Batch approval failed");
      }

      const result = await res.json();
      alert(result.message || "Approved, paid, and posted to Journal Entries!");
      setSelectedKeys([]);
      setBulkSelectAction("");
      setIsSelecting(false);
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
      {/* Aligned Fixed Header (No subtitle, clean Sync & Refresh button) */}
      <div className="page-header">
        <h1>Expenses &amp; Production Costing</h1>

        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchData}
          >
            Sync &amp; Refresh
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
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
            {loading
              ? "..."
              : `${stats.postedCount} / ${normalizedExpenses.length}`}
          </h2>
          <small>
            {stats.unpostedCount === 0
              ? "All expenses posted to ledger"
              : `${stats.unpostedCount} awaiting approval`}
          </small>
        </div>
      </div>

      {/* Search & Account Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search-input"
          placeholder="Search ID, description, or account..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          aria-label="Filter by Account"
        >
          <option value="ALL">All Accounts ({accounts.length})</option>
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
      </div>

      {/* Expense Register Table Card */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>Expense Register</h3>
            <p>
              Tap Select to choose pending items for category checking and
              payment
            </p>
          </div>

          {/* Right-side Select / Select Category to Check / Pay controls */}
          <div className="register-actions">
            {isSelecting && (
              <>
                <select
                  className="category-check-select"
                  value={bulkSelectAction}
                  onChange={(e) => handleBulkDropdownChange(e.target.value)}
                  aria-label="Select Category to Check"
                >
                  <option value="">Select Category to Check</option>
                  <option value="ALL_PRODUCTION">
                    Check All Pending Production
                  </option>
                  <option value="ALL_PAYROLL">
                    Check All Pending Payroll
                  </option>
                  <option value="ALL_PENDING">Check All Pending Items</option>
                  <option value="CLEAR">Uncheck All</option>
                </select>

                <button
                  type="button"
                  className="btn-pay"
                  disabled={approving || selectedKeys.length === 0}
                  onClick={handleBatchApprove}
                >
                  {approving
                    ? "Paying..."
                    : `Pay${selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ""}`}
                </button>
              </>
            )}

            <button
              type="button"
              className={`select-toggle-btn ${isSelecting ? "active" : ""}`}
              onClick={toggleSelectMode}
            >
              {isSelecting ? "Cancel" : "Select"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="state-message">Loading expenses...</p>
        ) : error ? (
          <p className="state-message error">Error: {error}</p>
        ) : (
          <table className="expenses-table">
            <thead>
              <tr>
                {isSelecting && (
                  <th className="checkbox-col">
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
                )}
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
                  <td
                    colSpan={isSelecting ? 7 : 6}
                    className="empty-table-cell"
                  >
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isChecked = selectedKeys.includes(exp.rowKey);
                  return (
                    <tr
                      key={exp.rowKey}
                      className={isChecked ? "checked-row" : undefined}
                    >
                      {isSelecting && (
                        <td>
                          <input
                            type="checkbox"
                            disabled={exp.isPosted}
                            checked={isChecked}
                            onChange={() => toggleSelectRow(exp.rowKey)}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{exp.rowKey}</strong>
                      </td>
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
                          <span className="badge">
                            HR Payroll → BPI Payroll
                          </span>
                        ) : exp.isProduction ? (
                          <span>Production #{exp.productionID}</span>
                        ) : (
                          <span className="muted-label">Direct Overhead</span>
                        )}
                      </td>
                      <td>
                        {exp.isPosted ? (
                          <span className="status posted">
                            {exp.isPayroll
                              ? `Paid • ${
                                  exp.reference_no ||
                                  `JE-${String(exp.postingID).padStart(4, "0")}`
                                }`
                              : exp.reference_no ||
                                `JE-${String(exp.postingID).padStart(4, "0")}`}
                          </span>
                        ) : (
                          <span className="status pending">
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{formatCurrency(exp.amount)}</strong>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Direct Expense Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <form className="modal-box" onSubmit={handleCreateExpense}>
            <h3>Add Direct Expense</h3>

            <label className="modal-label">
              Expense Account (Chart of Accounts) *
            </label>
            <select
              className="modal-input"
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

            <label className="modal-label">
              Description (Auto-posted to Journal Entries) *
            </label>
            <input
              type="text"
              className="modal-input"
              required
              placeholder="e.g. Meralco Electricity Bill or Office Supplies"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />

            <label className="modal-label">
              Production Order (Optional — Leave blank for Overhead)
            </label>
            {productions.length > 0 ? (
              <select
                className="modal-input"
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
                className="modal-input"
                placeholder="Optional: Production Order ID (leave blank for overhead)"
                value={formProductionId}
                onChange={(e) => setFormProductionId(e.target.value)}
              />
            )}

            <label className="modal-label">Amount *</label>
            <input
              type="number"
              step="0.01"
              className="modal-input"
              required
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <p className="modal-hint">
              Note: Saving automatically marks this expense paid and posts it
              directly to Journal Entries &amp; General Ledger.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
              >
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
