"use client";

import { useEffect, useState } from "react";
import "./globals.css";

interface DashboardData {
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    cashBalance: number;
    netIncome: number;
    totalRevenue: number;
    totalExpense: number;
    operatingInflows: number;
    operatingOutflows: number;
  };
  recentEntries: any[];
  ap: {
    outstandingInvoices: number;
    totalDue: number;
    dueThisWeek: number;
  };
  ar: {
    outstandingInvoices: number;
    totalReceivable: number;
    pastDue: number;
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Database Tables: Reads "BankAccount" + sums "ARReceipt" inflows minus "APPayment" outflows
          // Purpose: Computes live Cash Balance across all active bank accounts
          fetch("http://127.0.0.1:8000/api/bank"),

          // FETCH 3: GET http://127.0.0
          // Backend File: finance/backend/routers/journal.py -> get_journal_entries()
          // Database Tables: Reads "JournalEntry" joined with "JournalEntryLine"
          // Purpose: Populates the Recent Journal Entries table on the Dashboard
          fetch("http://127.0.0.1:8000/api/journal"),

          // FETCH 4: GET http://127.0.0
          // Backend File: finance/backend/routers/apinvoices.py -> get_ap_invoices()
          // Database Table: Reads "APInvoice"
          // Purpose: Filters out 'Paid' bills and sums remainingBalance + bills due within 7 days
          fetch("http://127.0.0.1:8000/api/apinvoices"),

          // FETCH 5: GET http://127.0.0
          // Backend File: finance/backend/routers/arinvoices.py -> get_ar_invoices()
          // Database Table: Reads "ARInvoice"
          // Purpose: Filters out 'Paid' customer invoices and sums remainingBalance + past due amounts
          fetch("http://127.0.0.1:8000/api/arinvoices"),

          // FETCH 6: GET http://127.0.0
          // Backend File: finance/backend/routers/reports.py -> cash_flow()
          // Database Tables: Sums "ARReceipt" inflows and "APPayment" outflows
          // Purpose: Powers the Cash Flow summary bar on the Dashboard
          fetch("http://127.0.0.1:8000/api/reports/cash-flow"),
        ]);

      const bsJson = bsRes.ok ? await bsRes.json() : {};
      const banksJson = bankRes.ok ? await bankRes.json() : [];
      const journalJson = journalRes.ok ? await journalRes.json() : [];
      const apJson = apRes.ok ? await apRes.json() : [];
      const arJson = arRes.ok ? await arRes.json() : [];
      const cfJson = cfRes.ok ? await cfRes.json() : {};

      // Live Cash Balance from Bank Accounts
      const liveCash = (Array.isArray(banksJson) ? banksJson : []).reduce(
        (sum: number, b: any) => sum + Number(b.balance || 0),
        0
      );

      // Date helpers (safely executed inside async effect, never during SSR render)
      const now = new Date();
      const todayIso = now.toISOString().split("T")[0];
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      const nextWeekIso = nextWeek.toISOString().split("T")[0];

      // Filter ONLY unpaid AP Invoices (remainingBalance > 0 and status != 'Paid')
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

      // Filter ONLY unpaid AR Invoices (remainingBalance > 0 and status != 'Paid')
      const openAR = (Array.isArray(arJson) ? arJson : []).filter(
        (inv: any) => {
          const rem = Number(
            inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
          );
          const stat = String(inv.status ?? "unpaid").toLowerCase();
          return rem > 0 && stat !== "paid";
        }
      );

      const arTotalReceivable = openAR.reduce(
        (sum: number, inv: any) =>
          sum +
          Number(
            inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
          ),
        0
      );

      const arPastDue = openAR
        .filter((inv: any) => {
          const d = inv.dueDate ?? inv.duedate ?? "";
          if (!d) return false;
          const iso = new Date(d).toISOString().split("T")[0];
          return iso < todayIso;
        })
        .reduce(
          (sum: number, inv: any) =>
            sum +
            Number(
              inv.remainingBalance ?? inv.remainingbalance ?? inv.amount ?? 0
            ),
          0
        );

      const totalAssets = Number(bsJson.totalAssets || 0) || liveCash + arTotalReceivable;
      const totalLiabilities = Number(bsJson.totalLiabilities || 0) || apTotalDue;

      setData({
        summary: {
          totalAssets,
          totalLiabilities,
          cashBalance: liveCash,
          netIncome: Number(bsJson.netIncome || 0),
          totalRevenue: Number(cfJson.operatingInflows || 0),
          totalExpense: Number(cfJson.operatingOutflows || 0),
          operatingInflows: Number(cfJson.operatingInflows || 0),
          operatingOutflows: Number(cfJson.operatingOutflows || 0),
        },
        recentEntries: (Array.isArray(journalJson) ? journalJson : []).slice(
          0,
          5
        ),
        ap: {
          outstandingInvoices: openAP.length,
          totalDue: apTotalDue,
          dueThisWeek: apDueThisWeek,
        },
        ar: {
          outstandingInvoices: openAR.length,
          totalReceivable: arTotalReceivable,
          pastDue: arPastDue,
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

    // Auto-refresh when returning to the Dashboard tab after paying a bill or recording a receipt
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
    return new Date(dateStr).toISOString().split("T")[0];
  };

  return (
    <div className="dashboard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Finance Dashboard
        </h1>
        <button
          onClick={fetchDashboard}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Refresh Live Data
        </button>
      </div>

      {error && (
        <p style={{ color: "red", marginBottom: "1rem" }}>
          Backend Connection Error: {error}
        </p>
      )}

      {/* Summary Cards */}
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

      {/* Live Cash Inflows vs Outflows Overview */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Receivables vs Payables</h2>
          <div style={{ padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>Open Accounts Receivable</span>
                <strong>{formatCurrency(data?.ar.totalReceivable)}</strong>
              </div>
              <div style={{ height: "10px", backgroundColor: "#e5e7eb", borderRadius: "6px", marginTop: "4px" }}>
                <div
                  style={{
                    height: "100%",
                    width:
                      (data?.ar.totalReceivable || 0) + (data?.ap.totalDue || 0) > 0
                        ? `${((data?.ar.totalReceivable || 0) / ((data?.ar.totalReceivable || 0) + (data?.ap.totalDue || 0))) * 100}%`
                        : "0%",
                    backgroundColor: "#2563eb",
                    borderRadius: "6px",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>Open Accounts Payable</span>
                <strong>{formatCurrency(data?.ap.totalDue)}</strong>
              </div>
              <div style={{ height: "10px", backgroundColor: "#e5e7eb", borderRadius: "6px", marginTop: "4px" }}>
                <div
                  style={{
                    height: "100%",
                    width:
                      (data?.ar.totalReceivable || 0) + (data?.ap.totalDue || 0) > 0
                        ? `${((data?.ap.totalDue || 0) / ((data?.ar.totalReceivable || 0) + (data?.ap.totalDue || 0))) * 100}%`
                        : "0%",
                    backgroundColor: "#dc2626",
                    borderRadius: "6px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Cash Flow Summary</h2>
          <div style={{ padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.95rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Cash Inflows (Collections):</span>
              <strong style={{ color: "#16a34a" }}>
                +{formatCurrency(data?.summary.operatingInflows)}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Cash Outflows (Payments):</span>
              <strong style={{ color: "#dc2626" }}>
                -{formatCurrency(data?.summary.operatingOutflows)}
              </strong>
            </div>
            <hr style={{ borderColor: "#e5e7eb" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ending Bank Cash:</span>
              <strong>{formatCurrency(data?.summary.cashBalance)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Entries */}
      <div className="panel">
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
                    {entry.referenceNo ??
                      entry.entryNumber ??
                      `JE-${entry.journalID ?? idx + 1}`}
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

      {/* AP/AR */}
      <div className="dashboard-row">
        <div className="panel">
          <h2>Accounts Payable</h2>

          <ul>
            <li>
              Outstanding Invoices:{" "}
              {loading ? "..." : data?.ap.outstandingInvoices ?? 0}
            </li>
            <li>
              Total Due:{" "}
              {loading ? "..." : formatCurrency(data?.ap.totalDue)}
            </li>
            <li>
              Due This Week:{" "}
              {loading ? "..." : formatCurrency(data?.ap.dueThisWeek)}
            </li>
          </ul>
        </div>

        <div className="panel">
          <h2>Accounts Receivable</h2>

          <ul>
            <li>
              Outstanding Invoices:{" "}
              {loading ? "..." : data?.ar.outstandingInvoices ?? 0}
            </li>
            <li>
              Total Receivable:{" "}
              {loading ? "..." : formatCurrency(data?.ar.totalReceivable)}
            </li>
            <li>
              Past Due:{" "}
              {loading ? "..." : formatCurrency(data?.ar.pastDue)}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}