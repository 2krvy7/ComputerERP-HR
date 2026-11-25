"use client";

import { useEffect, useState } from "react";
import "./globals.css";

interface CashFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
}

interface ReceivableHistoryItem {
  id: number | string;
  reference: string;
  customerName: string;
  amount: number;
  dueDate: string;
}

interface DashboardData {
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    cashBalance: number;
    netIncome: number;
    operatingInflows: number;
    operatingOutflows: number;
  };
  recentEntries: any[];
  cashFlowSeries: CashFlowPoint[];
  ap: {
    outstandingInvoices: number;
    totalDue: number;
    dueThisWeek: number;
  };
  arHistory: {
    collectedCount: number;
    totalCollected: number;
    recentItems: ReceivableHistoryItem[];
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [bsRes, bankRes, journalRes, apRes, arRes, cfRes] =
        await Promise.all([
          // FETCH 1: GET http://127.0.0
          // Backend File: finance/backend/routers/reports.py -> balance_sheet()
          // Database Tables: Reads "ChartOfAccounts" + "GeneralLedger"
          // Purpose: Computes live Total Assets, Total Liabilities, and Net Income
          fetch("http://127.0.0.1:8000/api/reports/balance-sheet"),

          // FETCH 2: GET http://127.0.0
          // Backend File: finance/backend/routers/bank.py -> get_bank_accounts()
          // Database Tables: Reads "BankAccount" + sums "ARReceipt" inflows minus "APPayment", Payroll & Expenses
          // Purpose: Computes live Cash Balance across all active bank accounts
          fetch("http://127.0.0.1:8000/api/bank"),

          // FETCH 3: GET http://127.0.0
          // Backend File: finance/backend/routers/journal.py -> get_journal_entries()
          // Database Tables: Reads "JournalEntry" joined with "JournalEntryLine"
          // Purpose: Populates Recent Journal Entries and builds chronological Cash Flow line graph points
          fetch("http://127.0.0.1:8000/api/journal"),

          // FETCH 4: GET http://127.0.0
          // Backend File: finance/backend/routers/apinvoices.py -> get_ap_invoices()
          // Database Table: Reads "APInvoice"
          // Purpose: Filters out 'Paid' bills and sums remainingBalance + bills due within 7 days
          fetch("http://127.0.0.1:8000/api/apinvoices"),

          // FETCH 5: GET http://127.0.0
          // Backend File: finance/backend/routers/arinvoices.py -> get_ar_invoices()
          // Database Table: Reads "ARInvoice" joined with "Customer"
          // Purpose: Builds the Receivables Collection History list for auto-collected Sales Invoices
          fetch("http://127.0.0.1:8000/api/arinvoices"),

          // FETCH 6: GET http://127.0.0
          // Backend File: finance/backend/routers/reports.py -> cash_flow()
          // Database Tables: Sums "ARReceipt" inflows and "APPayment", Payroll & Expense outflows
          // Purpose: Powers the Cash Flow Summary totals on the Dashboard
          fetch("http://127.0.0.1:8000/api/reports/cash-flow"),
        ]);

      const bsJson = bsRes.ok ? await bsRes.json() : {};
      const banksJson = bankRes.ok ? await bankRes.json() : [];
      const journalJson = journalRes.ok ? await journalRes.json() : [];
      const apJson = apRes.ok ? await apRes.json() : [];
      const arJson = arRes.ok ? await arRes.json() : [];
      const cfJson = cfRes.ok ? await cfRes.json() : {};

      const liveCash = (Array.isArray(banksJson) ? banksJson : []).reduce(
        (sum: number, b: any) => sum + Number(b.balance || 0),
        0
      );

      const now = new Date();
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      const nextWeekIso = nextWeek.toISOString().split("T")[0];

      const openAP = (Array.isArray(apJson) ? apJson : []).filter(
        (inv: any) => {
          const rem = Number(
            inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
          );
          const stat = String(inv.status ?? "unpaid").toLowerCase();
          return rem > 0 && stat !== "paid";
        }
      );

      const apTotalDue = openAP.reduce(
        (sum: number, inv: any) =>
          sum +
          Number(
            inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
          ),
        0
      );

      const apDueThisWeek = openAP
        .filter((inv: any) => {
          const d = inv.dueDate ?? inv.duedate ?? "";
          if (!d) return false;
          const iso = new Date(d).toISOString().split("T")[0];
          return iso <= nextWeekIso;
        })
        .reduce(
          (sum: number, inv: any) =>
            sum +
            Number(
              inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
            ),
          0
        );

      const allAR = (Array.isArray(arJson) ? arJson : []).filter(
        (inv: any) => Number(inv.arInvoiceID ?? inv.id ?? 0) !== 1
      );

      const totalCollectedAR = allAR.reduce(
        (sum: number, inv: any) =>
          sum + Number(inv.totalPaid ?? inv.amount ?? 0),
        0
      );

      const recentARItems: ReceivableHistoryItem[] = allAR
        .slice(0, 3)
        .map((inv: any, idx: number) => {
          const id = inv.arInvoiceID ?? inv.id ?? idx + 1;
          const sid = inv.salesInvoiceID ?? id;
          return {
            id,
            reference: `INV-${String(sid).padStart(4, "0")}`,
            customerName:
              inv.customerName || `Customer #${inv.customerID ?? "-"}`,
            amount: Number(inv.totalPaid ?? inv.amount ?? 0),
            dueDate: inv.dueDate ?? "",
          };
        });

      const allJournals = Array.isArray(journalJson) ? journalJson : [];
      const dailyMap = new Map<string, { inflow: number; outflow: number }>();

      for (const je of allJournals) {
        const mod = String(je.sourceModule || "").toLowerCase();
        if (mod === "cash transfer" || mod === "production cost") continue;

        const rawDate = je.journalDate ? String(je.journalDate).slice(0, 10) : "";
        if (!rawDate) continue;

        const amt = Number(je.totalDebit ?? je.amount ?? 0);
        if (amt <= 0) continue;

        const bucket = dailyMap.get(rawDate) || { inflow: 0, outflow: 0 };
        if (mod === "ar collection" || mod === "opening capital") {
          bucket.inflow += amt;
        } else {
          bucket.outflow += amt;
        }
        dailyMap.set(rawDate, bucket);
      }

      const sortedDates = Array.from(dailyMap.keys()).sort();
      const series: CashFlowPoint[] = sortedDates.map((d) => ({
        date: d,
        inflow: dailyMap.get(d)!.inflow,
        outflow: dailyMap.get(d)!.outflow,
      }));

      if (series.length === 0) {
        series.push({
          date: now.toISOString().slice(0, 10),
          inflow: Number(cfJson.operatingInflows || 0),
          outflow: Number(cfJson.operatingOutflows || 0),
        });
      }

      const totalAssets = Number(bsJson.totalAssets || 0) || liveCash;
      const totalLiabilities =
        Number(bsJson.totalLiabilities || 0) || apTotalDue;

      setData({
        summary: {
          totalAssets,
          totalLiabilities,
          cashBalance: liveCash,
          netIncome: Number(bsJson.netIncome || 0),
          operatingInflows: Number(cfJson.operatingInflows || 0),
          operatingOutflows: Number(cfJson.operatingOutflows || 0),
        },
        recentEntries: allJournals.slice(0, 5),
        cashFlowSeries: series,
        ap: {
          outstandingInvoices: openAP.length,
          totalDue: apTotalDue,
          dueThisWeek: apDueThisWeek,
        },
        arHistory: {
          collectedCount: allAR.length,
          totalCollected: totalCollectedAR,
          recentItems: recentARItems,
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    const handleFocus = () => fetchDashboard();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const formatCurrency = (val?: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return String(dateStr).slice(0, 10);
  };


    const series = data?.cashFlowSeries || [];
  const chartW = 460;
  const chartH = 165;
  const padX = 28;
  const padY = 20;
  const maxVal = Math.max(
    1,
    ...series.flatMap((pt) => [pt.inflow, pt.outflow])
  );

  const getX = (idx: number) =>
    series.length <= 1
      ? chartW / 2
      : padX + (idx / (series.length - 1)) * (chartW - padX * 2);

  const getY = (val: number) =>
    chartH - padY - (val / maxVal) * (chartH - padY * 2);

  const inflowPoints = series
    .map((pt, idx) => `${getX(idx)},${getY(pt.inflow)}`)
    .join(" ");
  const outflowPoints = series
    .map((pt, idx) => `${getX(idx)},${getY(pt.outflow)}`)
    .join(" ");

  const activePoint =
    hoveredIdx !== null && series[hoveredIdx]
      ? series[hoveredIdx]
      : series[series.length - 1] || null;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="page-title">Finance Dashboard</h1>
        <button
          type="button"
          className="dash-refresh-btn"
          onClick={fetchDashboard}
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="dash-error-banner">
          Backend Connection Error: {error}
        </p>
      )}

      <div className="card-grid">
        <div className="summary-card">
          <h3>Total Assets</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.totalAssets)}</p>
        </div>

        <div className="summary-card">
          <h3>Total Liabilities</h3>
          <p>
            {loading ? "..." : formatCurrency(data?.summary.totalLiabilities)}
          </p>
        </div>

        <div className="summary-card">
          <h3>Cash Balance</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.cashBalance)}</p>
        </div>

        <div className="summary-card">
          <h3>Net Income</h3>
          <p>{loading ? "..." : formatCurrency(data?.summary.netIncome)}</p>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="panel">
          <div className="panel-header-row">
            <h2>Cash Flow Trend</h2>
            <div className="chart-legend">
              <span>
                <i className="legend-dot inflow" />
                Inflows
              </span>
              <span>
                <i className="legend-dot outflow" />
                Outflows
              </span>
            </div>
          </div>

          <div className="line-chart-wrapper">
            <svg
              className="line-chart-svg"
              viewBox={`0 0 ${chartW} ${chartH}`}
              preserveAspectRatio="none"
            >
              {[0.25, 0.5, 0.75, 1].map((step) => (
                <line
                  key={step}
                  x1={padX}
                  x2={chartW - padX}
                  y1={chartH - padY - step * (chartH - padY * 2)}
                  y2={chartH - padY - step * (chartH - padY * 2)}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              {series.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={inflowPoints}
                />
              )}

              {series.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={outflowPoints}
                />
              )}

              {series.map((pt, idx) => {
                const cx = getX(idx);
                const cyIn = getY(pt.inflow);
                const cyOut = getY(pt.outflow);
                const isHovered = hoveredIdx === idx;
                return (
                  <g
                    key={pt.date}
                    className="chart-point-group"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cyIn}
                      r={isHovered ? 6 : 4}
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <circle
                      cx={cx}
                      cy={cyOut}
                      r={isHovered ? 6 : 4}
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>

            {activePoint && (
              <div className="chart-tooltip-bar">
                <span>
                  <strong>Date:</strong> {activePoint.date}
                </span>
                <span className="cf-inflow-val">
                  In: +{formatCurrency(activePoint.inflow)}
                </span>
                <span className="cf-outflow-val">
                  Out: -{formatCurrency(activePoint.outflow)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <h2>Cash Flow Summary</h2>
          <div className="cf-summary-list">
            <div className="cf-summary-item">
              <span>Cash Inflows (Collections):</span>
              <span className="cf-inflow-val">
                +{formatCurrency(data?.summary.operatingInflows)}
              </span>
            </div>
            <div className="cf-summary-item">
              <span>Cash Outflows (Payments):</span>
              <span className="cf-outflow-val">
                -{formatCurrency(data?.summary.operatingOutflows)}
              </span>
            </div>
            <hr className="cf-divider" />
            <div className="cf-summary-item">
              <span>Ending Bank Cash:</span>
              <span className="cf-ending-val">
                {formatCurrency(data?.summary.cashBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel recent-je-panel">
        <h2>Recent Journal Entries</h2>

        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Loading recent entries...</td>
              </tr>
            ) : !data?.recentEntries || data.recentEntries.length === 0 ? (
              <tr>
                <td colSpan={4}>No journal entries recorded yet.</td>
              </tr>
            ) : (
              data.recentEntries.map((entry, idx) => (
                <tr key={entry.journalID ?? entry.id ?? idx}>
                  <td>
                    {formatDate(
                      entry.journalDate ?? entry.date ?? entry.createdAt
                    )}
                  </td>
                  <td>
                    <strong>
                      {entry.referenceNo ??
                        entry.entryNumber ??
                        `JE-${entry.journalID ?? idx + 1}`}
                    </strong>
                  </td>
                  <td>{entry.description ?? "-"}</td>
                  <td>
                    {formatCurrency(entry.totalDebit ?? entry.amount ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="dashboard-row">
        <div className="panel">
          <h2>Accounts Payable</h2>

          <ul className="dash-stat-list">
            <li>
              <span>Outstanding Invoices:</span>
              <strong>
                {loading ? "..." : data?.ap.outstandingInvoices ?? 0}
              </strong>
            </li>
            <li>
              <span>Total Due:</span>
              <strong>
                {loading ? "..." : formatCurrency(data?.ap.totalDue)}
              </strong>
            </li>
            <li>
              <span>Due This Week:</span>
              <strong>
                {loading ? "..." : formatCurrency(data?.ap.dueThisWeek)}
              </strong>
            </li>
          </ul>
        </div>

        <div className="panel">
          <h2>Receivables History (Auto-Collected)</h2>

          <ul className="dash-stat-list">
            <li>
              <span>Auto-Collected Sales Invoices:</span>
              <strong>
                {loading ? "..." : data?.arHistory.collectedCount ?? 0}
              </strong>
            </li>
            <li>
              <span>Total Sales Collected:</span>
              <strong className="cf-inflow-val">
                {loading
                  ? "..."
                  : formatCurrency(data?.arHistory.totalCollected)}
              </strong>
            </li>
          </ul>

          {data?.arHistory.recentItems &&
            data.arHistory.recentItems.length > 0 && (
              <div className="ar-history-list">
                <span className="ar-history-title">
                  Recent Collected Invoices
                </span>
                {data.arHistory.recentItems.map((item) => (
                  <div key={item.id} className="ar-history-row">
                    <span>
                      <strong>{item.reference}</strong> · {item.customerName}
                      <span className="ar-history-badge">Paid</span>
                    </span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
