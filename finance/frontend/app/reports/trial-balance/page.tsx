"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./trial-balance.css";

type TrialAccount = {
  accountID: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
};

type TrialBalanceData = {
  accounts: TrialAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

export default function TrialBalance() {
  const [data, setData] = useState<TrialBalanceData>({
    accounts: [],
    totalDebits: 0,
    totalCredits: 0,
    isBalanced: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<
    "This month" | "This quarter" | "This year" | "Custom"
  >("This month");
  const [nonZeroOnly, setNonZeroOnly] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");

  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");


  async function fetchTrialBalance() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reports/trial-balance/`);
      if (!res.ok) throw new Error(`Trial Balance API error: ${res.status}`);
      const json = await res.json();
      setData({
        accounts: Array.isArray(json.accounts) ? json.accounts : [],
        totalDebits: Number(json.totalDebits || 0),
        totalCredits: Number(json.totalCredits || 0),
        isBalanced: Boolean(json.isBalanced),
      });
    } catch (err: any) {
      setError(err.message || "Failed to load Trial Balance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
    fetchTrialBalance();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const normalizedRows = useMemo(() => {
    return data.accounts.map((acc) => {
      const rawDiff = Number(acc.totalDebit || 0) - Number(acc.totalCredit || 0);
      const debitClosing = rawDiff > 0 ? rawDiff : 0;
      const creditClosing = rawDiff < 0 ? Math.abs(rawDiff) : 0;

      return {
        ...acc,
        debitClosing,
        creditClosing,
        hasActivity:
          debitClosing > 0 ||
          creditClosing > 0 ||
          Number(acc.totalDebit || 0) > 0 ||
          Number(acc.totalCredit || 0) > 0,
      };
    });
  }, [data.accounts]);

  const displayedAccounts = useMemo(() => {
    if (!nonZeroOnly) return normalizedRows;
    return normalizedRows.filter((a) => a.hasActivity);
  }, [normalizedRows, nonZeroOnly]);

  const totals = useMemo(() => {
    const debitSum = displayedAccounts.reduce((s, a) => s + a.debitClosing, 0);
    const creditSum = displayedAccounts.reduce(
      (s, a) => s + a.creditClosing,
      0
    );
    const difference = Math.abs(debitSum - creditSum);
    const nonZeroCount = normalizedRows.filter((a) => a.hasActivity).length;

    return {
      debitSum,
      creditSum,
      difference,
      isBalanced: difference < 0.01,
      nonZeroCount,
    };
  }, [displayedAccounts, normalizedRows]);

  function handleExportCSV() {
    const headers = [
      "Account Code",
      "Account Name",
      "Account Type",
      "Debit Balance",
      "Credit Balance",
    ];
    const rows = displayedAccounts.map((a) => [
      a.accountCode,
      `"${a.accountName}"`,
      a.accountType,
      a.debitClosing.toFixed(2),
      a.creditClosing.toFixed(2),
    ]);
    rows.push([
      "",
      "Total Balances",
      "",
      totals.debitSum.toFixed(2),
      totals.creditSum.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trial-balance-${new Date().toISOString().split("T")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }


    return (
    <div className="trial-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Trial Balance</h1>
          <p>
            Verify that your ledger balances before preparing financial
            statements.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light" onClick={handleExportCSV}>
            Export
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            Print Report
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="tabs">
        {(["This month", "This quarter", "This year", "Custom"] as const).map(
          (tab) => (
            <button
              key={tab}
              className={activePeriod === tab ? "active" : ""}
              onClick={() => setActivePeriod(tab)}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        <button className="btn-light">
          {todayLabel ? `As of ${todayLabel}` : "As of Today"}
        </button>

        <button className="btn-light">Accrual basis</button>

        <button
          className="btn-light"
          onClick={() => setNonZeroOnly((prev) => !prev)}
          style={
            nonZeroOnly
              ? { backgroundColor: "#111827", color: "#ffffff" }
              : undefined
          }
        >
          {nonZeroOnly ? "Non-zero accounts ✓" : "All accounts"}
        </button>

        <button className="btn-light push-right" onClick={fetchTrialBalance}>
          Update report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total debits</p>
          <h2>{loading ? "..." : formatCurrency(totals.debitSum)}</h2>
          <span>Closing debit balances</span>
        </div>

        <div className="summary-card">
          <p>Total credits</p>
          <h2>{loading ? "..." : formatCurrency(totals.creditSum)}</h2>
          <span>Closing credit balances</span>
        </div>

        <div className="summary-card">
          <p>Difference</p>
          <h2>{loading ? "..." : formatCurrency(totals.difference)}</h2>
          <span className={totals.isBalanced ? "green" : ""}>
            {totals.isBalanced
              ? "Your trial balance is balanced"
              : "Unbalanced ledger entries detected"}
          </span>
        </div>

        <div className="summary-card">
          <p>Ledger accounts</p>
          <h2>{loading ? "..." : data.accounts.length}</h2>
          <span>{totals.nonZeroCount} with non-zero balances</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>ComputerERP - Trial Balance</h3>
            <p>
              {todayLabel ? `As of ${todayLabel} • ` : ""}Period: {activePeriod}{" "}
              • USD
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading Trial Balance...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Account Type</th>
                <th>Debit Balance</th>
                <th>Credit Balance</th>
              </tr>
            </thead>

            <tbody>
              {displayedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                    No ledger accounts found.
                  </td>
                </tr>
              ) : (
                displayedAccounts.map((account) => (
                  <tr key={account.accountID}>
                    <td className="account-code">{account.accountCode}</td>
                    <td>{account.accountName}</td>
                    <td>{account.accountType}</td>
                    <td>
                      {account.debitClosing > 0
                        ? formatCurrency(account.debitClosing)
                        : "-"}
                    </td>
                    <td>
                      {account.creditClosing > 0
                        ? formatCurrency(account.creditClosing)
                        : "-"}
                    </td>
                  </tr>
                ))
              )}

              <tr className="totals-row">
                <td colSpan={3}>Total balances</td>
                <td>{formatCurrency(totals.debitSum)}</td>
                <td>{formatCurrency(totals.creditSum)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Message */}
      <div className="balance-banner">
        {totals.isBalanced
          ? "✅ Balanced: total debits equal total credits. All balances are drawn from posted ledger entries."
          : `⚠️ Out of Balance by ${formatCurrency(totals.difference)}: review unposted or unbalanced journal entries.`}
      </div>
    </div>
  );
}
