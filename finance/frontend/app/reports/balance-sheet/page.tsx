"use client";

import { useEffect, useMemo, useState } from "react";
import "./balance-sheet.css";

type AccountBalance = {
  accountID: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
};

type BalanceSheetData = {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
};

export default function BalanceSheet() {
  const [data, setData] = useState<BalanceSheetData>({
    assets: [],
    liabilities: [],
    equity: [],
    netIncome: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalLiabilitiesAndEquity: 0,
    isBalanced: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<
    "This month" | "This quarter" | "This year" | "Custom"
  >("This month");
  const [todayLabel, setTodayLabel] = useState("");

  async function fetchBalanceSheet() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/reports/balance-sheet");
      if (!res.ok) throw new Error(`Balance Sheet API error: ${res.status}`);
      const json = await res.json();
      setData({
        assets: Array.isArray(json.assets) ? json.assets : [],
        liabilities: Array.isArray(json.liabilities) ? json.liabilities : [],
        equity: Array.isArray(json.equity) ? json.equity : [],
        netIncome: Number(json.netIncome || 0),
        totalAssets: Number(json.totalAssets || 0),
        totalLiabilities: Number(json.totalLiabilities || 0),
        totalEquity: Number(json.totalEquity || 0),
        totalLiabilitiesAndEquity: Number(json.totalLiabilitiesAndEquity || 0),
        isBalanced: Boolean(json.isBalanced),
      });
    } catch (err: any) {
      setError(err.message || "Failed to load Balance Sheet");
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
    fetchBalanceSheet();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const { currentAssets, nonCurrentAssets, currentAssetTotal, nonCurrentAssetTotal } =
    useMemo(() => {
      const curr = data.assets.filter(
        (a) => Number(String(a.accountCode).replace(/\D/g, "")) < 1500
      );
      const nonCurr = data.assets.filter(
        (a) => Number(String(a.accountCode).replace(/\D/g, "")) >= 1500
      );
      return {
        currentAssets: curr,
        nonCurrentAssets: nonCurr,
        currentAssetTotal: curr.reduce((s, a) => s + Number(a.netBalance || 0), 0),
        nonCurrentAssetTotal: nonCurr.reduce((s, a) => s + Number(a.netBalance || 0), 0),
      };
    }, [data.assets]);

  const {
    currentLiabilities,
    nonCurrentLiabilities,
    currentLiabilityTotal,
    nonCurrentLiabilityTotal,
  } = useMemo(() => {
    const curr = data.liabilities.filter(
      (l) => Number(String(l.accountCode).replace(/\D/g, "")) < 2500
    );
    const nonCurr = data.liabilities.filter(
      (l) => Number(String(l.accountCode).replace(/\D/g, "")) >= 2500
    );
    return {
      currentLiabilities: curr,
      nonCurrentLiabilities: nonCurr,
      currentLiabilityTotal: curr.reduce((s, l) => s + Number(l.netBalance || 0), 0),
      nonCurrentLiabilityTotal: nonCurr.reduce(
        (s, l) => s + Number(l.netBalance || 0),
        0
      ),
    };
  }, [data.liabilities]);

  const workingCapital = currentAssetTotal - currentLiabilityTotal;

  function handleExportCSV() {
    const rows = [
      ["Section", "Account Code", "Account Name", "Balance"],
      ...data.assets.map((a) => [
        "Asset",
        a.accountCode,
        `"${a.accountName}"`,
        Number(a.netBalance || 0).toFixed(2),
      ]),
      ["Total Assets", "", "", data.totalAssets.toFixed(2)],
      ...data.liabilities.map((l) => [
        "Liability",
        l.accountCode,
        `"${l.accountName}"`,
        Number(l.netBalance || 0).toFixed(2),
      ]),
      ["Total Liabilities", "", "", data.totalLiabilities.toFixed(2)],
      ...data.equity.map((e) => [
        "Equity",
        e.accountCode,
        `"${e.accountName}"`,
        Number(e.netBalance || 0).toFixed(2),
      ]),
      ["Current Net Income", "", "", data.netIncome.toFixed(2)],
      ["Total Equity", "", "", data.totalEquity.toFixed(2)],
      [
        "Total Liabilities & Equity",
        "",
        "",
        data.totalLiabilitiesAndEquity.toFixed(2),
      ],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `balance-sheet-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="balance-sheet-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Balance Sheet</h1>
          <p>
            See what your business owns, what it owes and the equity
            you&apos;ve built.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-light" onClick={handleExportCSV}>
            Export
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            Print report
          </button>
        </div>
      </div>

      {/* Period Filter */}
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

      <div className="filters">
        <button className="btn-light">
          {todayLabel ? `As of ${todayLabel}` : "As of Today"}
        </button>
        <button className="btn-light">Period: {activePeriod}</button>
        <button className="btn-light">Accrual basis</button>
        <button className="btn-light push-right" onClick={fetchBalanceSheet}>
          Update report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Total Assets</p>
          <h2>{loading ? "..." : formatCurrency(data.totalAssets)}</h2>
          <span className="positive">{data.assets.length} asset accounts</span>
        </div>

        <div className="summary-card">
          <p>Total Liabilities</p>
          <h2>{loading ? "..." : formatCurrency(data.totalLiabilities)}</h2>
          <span>{data.liabilities.length} liability accounts</span>
        </div>

        <div className="summary-card">
          <p>Total Equity</p>
          <h2>{loading ? "..." : formatCurrency(data.totalEquity)}</h2>
          <span>Includes current net income</span>
        </div>

        <div className="summary-card">
          <p>Working Capital</p>
          <h2>{loading ? "..." : formatCurrency(workingCapital)}</h2>
          <span>Current assets less current liabilities</span>
        </div>
      </div>

      {error && (
        <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
      )}

      {/* Two Column Statements */}
      <div className="statement-grid">
        {/* Assets */}
        <div className="statement-card">
          <div className="statement-header">
            <h3>ComputerERP - Assets</h3>
            <p>Financial position · USD · Accrual basis</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Code</th>
                <th>{todayLabel ? `As of ${todayLabel}` : "Current Balance"}</th>
              </tr>
            </thead>

            <tbody>
              <tr className="section-row">
                <td colSpan={3}>Current Assets</td>
              </tr>

              {currentAssets.length === 0 ? (
                <tr>
                  <td colSpan={3}>No current asset accounts recorded</td>
                </tr>
              ) : (
                currentAssets.map((acc) => (
                  <tr key={acc.accountID}>
                    <td>{acc.accountName}</td>
                    <td>{acc.accountCode}</td>
                    <td>{formatCurrency(acc.netBalance)}</td>
                  </tr>
                ))
              )}

              <tr className="total-row">
                <td colSpan={2}>Total Current Assets</td>
                <td>{formatCurrency(currentAssetTotal)}</td>
              </tr>

              <tr className="section-row">
                <td colSpan={3}>Non-Current Assets</td>
              </tr>

              {nonCurrentAssets.length === 0 ? (
                <tr>
                  <td colSpan={3}>No non-current asset accounts recorded</td>
                </tr>
              ) : (
                nonCurrentAssets.map((acc) => (
                  <tr key={acc.accountID}>
                    <td>{acc.accountName}</td>
                    <td>{acc.accountCode}</td>
                    <td>{formatCurrency(acc.netBalance)}</td>
                  </tr>
                ))
              )}

              <tr className="total-row">
                <td colSpan={2}>Net Non-Current Assets</td>
                <td>{formatCurrency(nonCurrentAssetTotal)}</td>
              </tr>

              <tr className="grand-total">
                <td colSpan={2}>Total Assets</td>
                <td>{formatCurrency(data.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities & Equity */}
        <div className="statement-card">
          <div className="statement-header">
            <h3>Liabilities &amp; Equity</h3>
            <p>{todayLabel ? `As of ${todayLabel}` : "Current Position"}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Code</th>
                <th>{todayLabel ? `As of ${todayLabel}` : "Current Balance"}</th>
              </tr>
            </thead>

            <tbody>
              <tr className="section-row">
                <td colSpan={3}>Current Liabilities</td>
              </tr>

              {currentLiabilities.length === 0 ? (
                <tr>
                  <td colSpan={3}>No current liability accounts recorded</td>
                </tr>
              ) : (
                currentLiabilities.map((acc) => (
                  <tr key={acc.accountID}>
                    <td>{acc.accountName}</td>
                    <td>{acc.accountCode}</td>
                    <td>{formatCurrency(acc.netBalance)}</td>
                  </tr>
                ))
              )}

              <tr className="total-row">
                <td colSpan={2}>Total Current Liabilities</td>
                <td>{formatCurrency(currentLiabilityTotal)}</td>
              </tr>

              {nonCurrentLiabilities.length > 0 && (
                <>
                  <tr className="section-row">
                    <td colSpan={3}>Non-Current Liabilities</td>
                  </tr>
                  {nonCurrentLiabilities.map((acc) => (
                    <tr key={acc.accountID}>
                      <td>{acc.accountName}</td>
                      <td>{acc.accountCode}</td>
                      <td>{formatCurrency(acc.netBalance)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={2}>Total Non-Current Liabilities</td>
                    <td>{formatCurrency(nonCurrentLiabilityTotal)}</td>
                  </tr>
                </>
              )}

              <tr className="total-row">
                <td colSpan={2}>Total Liabilities</td>
                <td>{formatCurrency(data.totalLiabilities)}</td>
              </tr>

              <tr className="section-row">
                <td colSpan={3}>Equity</td>
              </tr>

              {data.equity.map((acc) => (
                <tr key={acc.accountID}>
                  <td>{acc.accountName}</td>
                  <td>{acc.accountCode}</td>
                  <td>{formatCurrency(acc.netBalance)}</td>
                </tr>
              ))}

              <tr>
                <td>Current Period Net Income</td>
                <td>-</td>
                <td>{formatCurrency(data.netIncome)}</td>
              </tr>

              <tr className="grand-total">
                <td colSpan={2}>Total Equity</td>
                <td>{formatCurrency(data.totalEquity)}</td>
              </tr>

              <tr className="grand-total">
                <td colSpan={2}>Total Liabilities + Equity</td>
                <td>{formatCurrency(data.totalLiabilitiesAndEquity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Check */}
      <div className="balance-check">
        {data.isBalanced ? "✅ Balanced:" : "⚠️ Out of Balance:"} Assets{" "}
        {formatCurrency(data.totalAssets)} = Liabilities{" "}
        {formatCurrency(data.totalLiabilities)} + Equity{" "}
        {formatCurrency(data.totalEquity)}
      </div>
    </div>
  );
}