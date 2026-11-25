"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./income-statement.css";

type AccountBalance = {
  accountID: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
};

type IncomeStatementData = {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
};

export default function IncomeStatement() {
  const [data, setData] = useState<IncomeStatementData>({
    revenues: [],
    expenses: [],
    totalRevenue: 0,
    totalExpense: 0,
    netIncome: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<
    "This month" | "This quarter" | "This year" | "Custom"
  >("This month");
  const [todayLabel, setTodayLabel] = useState("");

  const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");


  async function fetchIncomeStatement() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/reports/income-statement/`
      );
      if (!res.ok)
        throw new Error(`Income Statement API error: ${res.status}`);
      const json = await res.json();
      setData({
        revenues: Array.isArray(json.revenues) ? json.revenues : [],
        expenses: Array.isArray(json.expenses) ? json.expenses : [],
        totalRevenue: Number(json.totalRevenue || 0),
        totalExpense: Number(json.totalExpense || 0),
        netIncome: Number(json.netIncome || 0),
      });
    } catch (err: any) {
      setError(err.message || "Failed to load Income Statement");
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
    fetchIncomeStatement();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const { cogsAccounts, opexAccounts, totalCogs, totalOpex } = useMemo(() => {
    const cogs = data.expenses.filter((e) => {
      const num = Number(String(e.accountCode).replace(/\D/g, ""));
      return num >= 5000 && num < 5100;
    });
    const opex = data.expenses.filter((e) => {
      const num = Number(String(e.accountCode).replace(/\D/g, ""));
      return num < 5000 || num >= 5100;
    });
    return {
      cogsAccounts: cogs,
      opexAccounts: opex,
      totalCogs: cogs.reduce((s, e) => s + Number(e.netBalance || 0), 0),
      totalOpex: opex.reduce((s, e) => s + Number(e.netBalance || 0), 0),
    };
  }, [data.expenses]);

  const grossProfit = data.totalRevenue - totalCogs;
  const grossMarginPct =
    data.totalRevenue > 0
      ? ((grossProfit / data.totalRevenue) * 100).toFixed(1)
      : "0.0";
  const netMarginPct =
    data.totalRevenue > 0
      ? ((data.netIncome / data.totalRevenue) * 100).toFixed(1)
      : "0.0";

  function handleExportCSV() {
    const rows = [
      ["Section", "Account Code", "Account Name", "Amount"],
      ...data.revenues.map((r) => [
        "Revenue",
        r.accountCode,
        `"${r.accountName}"`,
        Number(r.netBalance || 0).toFixed(2),
      ]),
      ["Total Revenue", "", "", data.totalRevenue.toFixed(2)],
      ...cogsAccounts.map((c) => [
        "Cost of Sales",
        c.accountCode,
        `"${c.accountName}"`,
        Number(c.netBalance || 0).toFixed(2),
      ]),
      ["Gross Profit", "", "", grossProfit.toFixed(2)],
      ...opexAccounts.map((o) => [
        "Operating Expense",
        o.accountCode,
        `"${o.accountName}"`,
        Number(o.netBalance || 0).toFixed(2),
      ]),
      ["Total Costs & Expenses", "", "", data.totalExpense.toFixed(2)],
      ["Net Income", "", "", data.netIncome.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `income-statement-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

    return (
    <div className="income-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Income Statement</h1>
          <p>
            Understand what you earned, what you spent and the profit left over.
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
        <button className="btn-light">Period: {activePeriod}</button>
        <button className="btn-light">Accrual basis</button>

        <button
          className="btn-light push-right"
          onClick={fetchIncomeStatement}
        >
          Update report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Revenue</p>
          <h2>{loading ? "..." : formatCurrency(data.totalRevenue)}</h2>
          <span className="positive">
            {data.revenues.length} revenue{" "}
            {data.revenues.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        <div className="summary-card">
          <p>Total costs &amp; expenses</p>
          <h2>{loading ? "..." : formatCurrency(data.totalExpense)}</h2>
          <span>
            {data.expenses.length} expense{" "}
            {data.expenses.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        <div className="summary-card">
          <p>Net income</p>
          <h2>{loading ? "..." : formatCurrency(data.netIncome)}</h2>
          <span className={data.netIncome >= 0 ? "positive" : "negative"}>
            {data.netIncome >= 0 ? "Net Profit" : "Net Loss"}
          </span>
        </div>

        <div className="summary-card">
          <p>Net profit margin</p>
          <h2>{loading ? "..." : `${netMarginPct}%`}</h2>
          <span>Gross margin: {grossMarginPct}%</span>
        </div>
      </div>

      {error && (
        <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
      )}

      {/* Statement Table */}
      <div className="table-card">
        <div className="table-header">
          <h3>ComputerERP - Income Statement</h3>
          <p>
            {todayLabel ? `As of ${todayLabel} • ` : ""}Accrual basis • USD
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Code</th>
              <th>Total Debits</th>
              <th>Total Credits</th>
              <th>Net Amount</th>
            </tr>
          </thead>

          <tbody>
            {/* Revenue */}
            <tr className="section-row">
              <td colSpan={5}>Revenue</td>
            </tr>

            {data.revenues.length === 0 ? (
              <tr>
                <td colSpan={5}>No revenue accounts posted yet</td>
              </tr>
            ) : (
              data.revenues.map((acc) => (
                <tr key={acc.accountID}>
                  <td>{acc.accountName}</td>
                  <td>{acc.accountCode}</td>
                  <td>{formatCurrency(acc.totalDebit)}</td>
                  <td>{formatCurrency(acc.totalCredit)}</td>
                  <td className="positive">{formatCurrency(acc.netBalance)}</td>
                </tr>
              ))
            )}

            <tr className="total-row">
              <td colSpan={4}>Total Revenue</td>
              <td>{formatCurrency(data.totalRevenue)}</td>
            </tr>

            {/* Cost of Sales */}
            <tr className="section-row">
              <td colSpan={5}>Cost of Sales / Production Costs</td>
            </tr>

            {cogsAccounts.length === 0 ? (
              <tr>
                <td colSpan={5}>No direct production costs posted yet</td>
              </tr>
            ) : (
              cogsAccounts.map((acc) => (
                <tr key={acc.accountID}>
                  <td>{acc.accountName}</td>
                  <td>{acc.accountCode}</td>
                  <td>{formatCurrency(acc.totalDebit)}</td>
                  <td>{formatCurrency(acc.totalCredit)}</td>
                  <td>{formatCurrency(acc.netBalance)}</td>
                </tr>
              ))
            )}

            <tr className="gross-profit-row">
              <td colSpan={4}>Gross Profit</td>
              <td>{formatCurrency(grossProfit)}</td>
            </tr>

            {/* Operating Expenses */}
            <tr className="section-row">
              <td colSpan={5}>Operating Expenses</td>
            </tr>

            {opexAccounts.length === 0 ? (
              <tr>
                <td colSpan={5}>No operating expense accounts posted yet</td>
              </tr>
            ) : (
              opexAccounts.map((acc) => (
                <tr key={acc.accountID}>
                  <td>{acc.accountName}</td>
                  <td>{acc.accountCode}</td>
                  <td>{formatCurrency(acc.totalDebit)}</td>
                  <td>{formatCurrency(acc.totalCredit)}</td>
                  <td>{formatCurrency(acc.netBalance)}</td>
                </tr>
              ))
            )}

            <tr className="total-row">
              <td colSpan={4}>Total Operating Expenses</td>
              <td>{formatCurrency(totalOpex)}</td>
            </tr>

            <tr className="total-row">
              <td colSpan={4}>Total Costs &amp; Expenses</td>
              <td>{formatCurrency(data.totalExpense)}</td>
            </tr>

            <tr className="net-income-row">
              <td colSpan={4}>Net Income</td>
              <td>{formatCurrency(data.netIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Analysis */}
      <div className="analysis-card">
        <p>
          Total revenue stands at {formatCurrency(data.totalRevenue)} against{" "}
          {formatCurrency(data.totalExpense)} in total costs and expenses,
          resulting in {formatCurrency(data.netIncome)} net income.
        </p>

        <p>
          Gross margin: {grossMarginPct}% (Gross profit of{" "}
          {formatCurrency(grossProfit)} after {formatCurrency(totalCogs)} in
          direct production/service costs).
        </p>
      </div>
    </div>
  );
}
