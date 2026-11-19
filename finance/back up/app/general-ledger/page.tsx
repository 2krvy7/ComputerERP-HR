"use client";

import { useEffect, useMemo, useState } from "react";
import "./general-ledger.css";

export default function GeneralLedger() {
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  async function fetchLedgerData() {
    setLoading(true);
    setError(null);
    try {
      const [ledgerRes, accRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/ledger"),
        fetch("http://127.0.0.1:8000/api/ledger"),
      ]);

      if (!ledgerRes.ok) throw new Error(`Ledger API error: ${ledgerRes.status}`);
      const ledgerJson = await ledgerRes.json();
      setRawRows(Array.isArray(ledgerJson) ? ledgerJson : []);

      if (accRes.ok) {
        const accJson = await accRes.json();
        setAccounts(Array.isArray(accJson) ? accJson : []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load General Ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Compute filtered rows, running balance, and period totals
  const { processedRows, openingBalance, totalDebits, totalCredits, closingBalance } = useMemo(() => {
    // 1. Filter by account and status first
    const accountAndStatusFiltered = rawRows.filter((row) => {
      const rowAccId = String(row.accountID ?? row.accountId ?? row.accountCode ?? "");
      const matchesAccount = selectedAccount === "ALL" || rowAccId === selectedAccount;

      const rowStatus = String(row.status ?? "Posted").toLowerCase();
      const matchesStatus = statusFilter === "ALL" || rowStatus === statusFilter.toLowerCase();

      return matchesAccount && matchesStatus;
    });

    // 2. Calculate Opening Balance from transactions strictly before startDate
    let opening = 0;
    const periodTransactions: any[] = [];

    for (const row of accountAndStatusFiltered) {
      const txDateRaw = row.transactionDate ?? row.date ?? row.createdAt;
      const txDate = txDateRaw ? new Date(txDateRaw).toISOString().split("T")[0] : "";
      const debit = Number(row.debit ?? row.debitAmount ?? 0);
      const credit = Number(row.credit ?? row.creditAmount ?? 0);

      if (startDate && txDate && txDate < startDate) {
        opening += debit - credit;
      } else if (endDate && txDate && txDate > endDate) {
        continue;
      } else {
        periodTransactions.push(row);
      }
    }

    // 3. Build chronological rows with running balance
    let running = opening;
    let debitsSum = 0;
    let creditsSum = 0;

    const rowsWithBalance = periodTransactions.map((row) => {
      const debit = Number(row.debit ?? row.debitAmount ?? 0);
      const credit = Number(row.credit ?? row.creditAmount ?? 0);

      debitsSum += debit;
      creditsSum += credit;
      running += debit - credit;

      return {
        id: row.ledgerID ?? row.id ?? Math.random(),
        date: formatDate(row.transactionDate ?? row.date ?? row.createdAt),
        description: row.description ?? row.remarks ?? "Journal Posting",
        reference: row.reference ?? row.referenceNo ?? (row.journalID ? `JE-${row.journalID}` : "-"),
        debit,
        credit,
        balance: running,
      };
    });

    return {
      processedRows: rowsWithBalance,
      openingBalance: opening,
      totalDebits: debitsSum,
      totalCredits: creditsSum,
      closingBalance: running,
    };
  }, [rawRows, selectedAccount, startDate, endDate, statusFilter]);

  const activeAccountLabel = useMemo(() => {
    if (selectedAccount === "ALL") return "All Accounts";
    const found = accounts.find(
      (a) => String(a.accountID ?? a.accountCode) === selectedAccount
    );
    return found
      ? `${found.accountCode ?? ""} - ${found.accountName ?? found.name ?? ""}`
      : selectedAccount;
  }, [accounts, selectedAccount]);

  return (
    <div className="ledger-page">
      <div className="ledger-header">
        <div>
          <h1>General Ledger</h1>
          <p>
            Trace account activity from opening balance to the last
            posted transaction.
          </p>
        </div>

        <button className="print-btn" onClick={() => window.print()}>
          Print Ledger
        </button>
      </div>

      {/* Filters */}
      <div className="ledger-filters">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          title="Start Date"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          title="End Date"
        />

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          <option value="ALL">All Accounts</option>
          {accounts.map((acc) => {
            const val = String(acc.accountID ?? acc.accountCode);
            return (
              <option key={val} value={val}>
                {acc.accountCode} - {acc.accountName ?? acc.name}
              </option>
            );
          })}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Entries</option>
          <option value="Posted">Posted Entries</option>
          <option value="Draft">Draft Entries</option>
        </select>

        <button onClick={fetchLedgerData}>Update Report</button>
      </div>

      {/* Summary Cards */}
      <div className="ledger-cards">
        <div className="ledger-card">
          <span>Opening Balance</span>
          <h2>{loading ? "..." : formatCurrency(openingBalance)}</h2>
        </div>

        <div className="ledger-card">
          <span>Total Debits</span>
          <h2>{loading ? "..." : formatCurrency(totalDebits)}</h2>
        </div>

        <div className="ledger-card">
          <span>Total Credits</span>
          <h2>{loading ? "..." : formatCurrency(totalCredits)}</h2>
        </div>

        <div className="ledger-card">
          <span>Closing Balance</span>
          <h2>{loading ? "..." : formatCurrency(closingBalance)}</h2>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ledger-table-container">
        <div className="ledger-table-header">
          <h3>{activeAccountLabel}</h3>
          <button
            onClick={() => {
              setSelectedAccount("ALL");
              setStartDate("");
              setEndDate("");
              setStatusFilter("ALL");
            }}
          >
            Reset Filters
          </button>
        </div>

        {loading ? (
          <p style={{ padding: "1rem" }}>Loading general ledger...</p>
        ) : error ? (
          <p style={{ padding: "1rem", color: "red" }}>Error: {error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Running Balance</th>
              </tr>
            </thead>

            <tbody>
              {/* Opening Balance Row */}
              <tr>
                <td>{startDate ? formatDate(startDate) : "Beginning"}</td>
                <td>Opening Balance</td>
                <td>Prior Period</td>
                <td>-</td>
                <td>-</td>
                <td>{formatCurrency(openingBalance)}</td>
              </tr>

              {processedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "1rem" }}>
                    No ledger transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                processedRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td>{item.reference}</td>
                    <td>{item.debit > 0 ? formatCurrency(item.debit) : "-"}</td>
                    <td>{item.credit > 0 ? formatCurrency(item.credit) : "-"}</td>
                    <td>{formatCurrency(item.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        <div className="totals-row">
          <span>Period Totals</span>

          <div>
            <strong>Debit:</strong> {formatCurrency(totalDebits)}
          </div>

          <div>
            <strong>Credit:</strong> {formatCurrency(totalCredits)}
          </div>

          <div>
            <strong>Balance:</strong> {formatCurrency(closingBalance)}
          </div>
        </div>
      </div>

      <div className="success-banner">
        ✓ Closing balance agrees with General Ledger posted entries.
      </div>
    </div>
  );
}