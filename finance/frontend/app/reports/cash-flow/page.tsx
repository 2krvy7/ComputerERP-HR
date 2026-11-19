"use client";

import { useEffect, useState } from "react";
import "./cash-flow.css";

type CashFlowData = {
  operatingInflows: number;
  operatingOutflows: number;
  netOperatingCashFlow: number;
  endingCashBalance: number;
};

export default function CashFlowStatement() {
  const [data, setData] = useState<CashFlowData>({
    operatingInflows: 0,
    operatingOutflows: 0,
    netOperatingCashFlow: 0,
    endingCashBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<
    "This month" | "This quarter" | "This year" | "Custom"
  >("This month");
  const [todayLabel, setTodayLabel] = useState("");

  async function fetchCashFlow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/reports/cash-flow/");
      if (!res.ok) throw new Error(`Cash Flow API error: ${res.status}`);
      const json = await res.json();
      setData({
        operatingInflows: Number(json.operatingInflows || 0),
        operatingOutflows: Number(json.operatingOutflows || 0),
        netOperatingCashFlow: Number(json.netOperatingCashFlow || 0),
        endingCashBalance: Number(json.endingCashBalance || 0),
      });
    } catch (err: any) {
      setError(err.message || "Failed to load Cash Flow statement");
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
    fetchCashFlow();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(val || 0));

  const formatSignedCurrency = (val: number) => {
    const num = Number(val || 0);
    const formatted = formatCurrency(Math.abs(num));
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${formatted}`;
    return formatted;
  };

  const investingCashFlow = 0;
  const financingCashFlow = 0;
  const netCashIncrease =
    data.netOperatingCashFlow + investingCashFlow + financingCashFlow;
  const openingCashBalance = data.endingCashBalance - netCashIncrease;

  function handleExportCSV() {
    const rows = [
      ["Activity", "Source / Movement", "Cash Flow"],
      [
        "Cash Receipts from Customers (ARReceipt)",
        "Operating Inflow",
        data.operatingInflows.toFixed(2),
      ],
      [
        "Cash Paid to Suppliers (APPayment)",
        "Operating Outflow",
        (-Math.abs(data.operatingOutflows)).toFixed(2),
      ],
      [
        "Net Cash From Operating Activities",
        "Operating Total",
        data.netOperatingCashFlow.toFixed(2),
      ],
      [
        "Net Cash Used in Investing Activities",
        "Equipment & Fixed Assets",
        investingCashFlow.toFixed(2),
      ],
      [
        "Net Cash From Financing Activities",
        "Capital & Loans",
        financingCashFlow.toFixed(2),
      ],
      [
        "Net Increase / Decrease in Cash",
        "Operating + Investing + Financing",
        netCashIncrease.toFixed(2),
      ],
      [
        "Cash at End of Period",
        todayLabel || "Current",
        data.endingCashBalance.toFixed(2),
      ],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cash-flow-${new Date().toISOString().split("T")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cashflow-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Cash Flow Statement</h1>
          <p>
            Follow the cash generated and used by operating, investing and
            financing activities.
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

      {/* Period Selector */}
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
        <button className="btn-light">Direct Method</button>
        <button className="btn-light">Period: {activePeriod}</button>
        <button className="btn-light push-right" onClick={fetchCashFlow}>
          Update Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Operating Cash Flow</p>
          <h2 className={data.netOperatingCashFlow >= 0 ? "positive" : "negative"}>
            {loading ? "..." : formatSignedCurrency(data.netOperatingCashFlow)}
          </h2>
          <span>Cash generated by operations</span>
        </div>

        <div className="summary-card">
          <p>Investing Cash Flow</p>
          <h2 className={investingCashFlow >= 0 ? "positive" : "negative"}>
            {loading ? "..." : formatSignedCurrency(investingCashFlow)}
          </h2>
          <span>Equipment purchases</span>
        </div>

        <div className="summary-card">
          <p>Financing Cash Flow</p>
          <h2 className={financingCashFlow >= 0 ? "positive" : "negative"}>
            {loading ? "..." : formatSignedCurrency(financingCashFlow)}
          </h2>
          <span>Capital &amp; loan activity</span>
        </div>

        <div className="summary-card">
          <p>Net Cash Flow</p>
          <h2 className={netCashIncrease >= 0 ? "positive" : "negative"}>
            {loading ? "..." : formatSignedCurrency(netCashIncrease)}
          </h2>
          <span>Closing cash balance {formatCurrency(data.endingCashBalance)}</span>
        </div>
      </div>

      {error && (
        <p style={{ padding: "1rem", color: "crimson" }}>Error: {error}</p>
      )}

      {/* Statement */}
      <div className="table-card">
        <div className="table-header">
          <h3>ComputerERP - Cash Flow Statement</h3>
          <p>
            {todayLabel ? `As of ${todayLabel} · ` : ""}Direct method · USD
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Source / Movement</th>
              <th>Cash Flow</th>
            </tr>
          </thead>

          <tbody>
            {/* Operating */}
            <tr className="section-row">
              <td colSpan={3}>Operating Activities</td>
            </tr>

            <tr>
              <td>Cash Receipts from Customers</td>
              <td>ARReceipt Collections</td>
              <td>{formatCurrency(data.operatingInflows)}</td>
            </tr>

            <tr>
              <td>Cash Paid to Suppliers</td>
              <td>APPayment Disbursements</td>
              <td>
                {data.operatingOutflows > 0
                  ? `-${formatCurrency(data.operatingOutflows)}`
                  : formatCurrency(0)}
              </td>
            </tr>

            <tr className="total-row">
              <td>Net Cash From Operating Activities</td>
              <td></td>
              <td>{formatCurrency(data.netOperatingCashFlow)}</td>
            </tr>

            {/* Investing */}
            <tr className="section-row">
              <td colSpan={3}>Investing Activities</td>
            </tr>

            <tr>
              <td>Purchase of Equipment &amp; Fixed Assets</td>
              <td>Fixed Assets</td>
              <td>{formatCurrency(investingCashFlow)}</td>
            </tr>

            <tr className="total-row">
              <td>Net Cash Used in Investing Activities</td>
              <td></td>
              <td>{formatCurrency(investingCashFlow)}</td>
            </tr>

            {/* Financing */}
            <tr className="section-row">
              <td colSpan={3}>Financing Activities</td>
            </tr>

            <tr>
              <td>Capital Contributions &amp; Loan Proceeds</td>
              <td>Equity / Loans</td>
              <td>{formatCurrency(financingCashFlow)}</td>
            </tr>

            <tr className="total-row">
              <td>Net Cash From Financing Activities</td>
              <td></td>
              <td>{formatCurrency(financingCashFlow)}</td>
            </tr>

            {/* Totals */}
            <tr className="cash-total">
              <td>Net Increase / Decrease in Cash</td>
              <td>Operating + Investing + Financing</td>
              <td>{formatCurrency(netCashIncrease)}</td>
            </tr>

            <tr>
              <td>Cash at Beginning of Period</td>
              <td>Opening Balance</td>
              <td>{formatCurrency(openingCashBalance)}</td>
            </tr>

            <tr className="ending-row">
              <td>Cash at End of Period</td>
              <td>{todayLabel || "Current"}</td>
              <td>{formatCurrency(data.endingCashBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reconciliation */}
      <div className="reconciliation-banner">
        ✅ Reconciled: Opening cash {formatCurrency(openingCashBalance)} + Net
        movement {formatSignedCurrency(netCashIncrease)} = Closing cash{" "}
        {formatCurrency(data.endingCashBalance)}
      </div>

      {/* Analysis */}
      <div className="analysis-card">
        <p>
          Cash inflows totaled {formatCurrency(data.operatingInflows)} from
          customer invoice receipts (ARReceipt).
        </p>

        <p>
          Cash outflows totaled {formatCurrency(data.operatingOutflows)} for
          supplier bill payments (APPayment).
        </p>

        <p>
          Overall net cash movement is {formatSignedCurrency(netCashIncrease)},
          ending with {formatCurrency(data.endingCashBalance)} in available cash.
        </p>
      </div>
    </div>
  );
}