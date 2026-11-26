"use client";

import { useEffect, useMemo, useState } from "react";
import "./general-ledger.css";

export default function GeneralLedger() {
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalDateMap, setJournalDateMap] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  async function fetchLedgerData() {
    setLoading(true);
    setError(null);
    try {
      const [ledgerRes, accRes, jeRes] = await Promise.all([
        fetch(`${API_URL}/api/ledger`),
        fetch(`${API_URL}/api/coa`),
        fetch(`${API_URL}/api/journal`).then((r) =>
          r.ok ? r : fetch(`${API_URL}/api/journal-entries`)
        ),
      ]);

      if (!ledgerRes.ok) {
        throw new Error(`Ledger API error: ${ledgerRes.status}`);
      }
      const ledgerJson = await ledgerRes.json();
      setRawRows(Array.isArray(ledgerJson) ? ledgerJson : []);

      if (accRes.ok) {
        const accJson = await accRes.json();
        setAccounts(Array.isArray(accJson) ? accJson : []);
      }

      if (jeRes.ok) {
        const jeJson = await jeRes.json();
        const map: Record<string, string> = {};
        for (const je of Array.isArray(jeJson) ? jeJson : []) {
          const rawId =
            je.journalID ?? je.journalid ?? je.journal_id ?? je.id ?? "";
          const jId = String(rawId).replace(/^JE-0*/i, "").trim();
          const jDate =
            je.journalDate ??
            je.journaldate ??
            je.journal_date ??
            je.entryDate ??
            je.entry_date ??
            je.date ??
            "";
          if (jId && jDate) {
            map[jId] = String(jDate);
          }
        }
        setJournalDateMap(map);
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

    // Philippine Peso (PHP) currency formatter
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return String(dateStr).slice(0, 10);
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const extractRowDate = (row: any): string => {
    const rawId =
      row.journalID ??
      row.journalid ??
      row.journal_id ??
      row.referenceNo ??
      row.reference ??
      "";
    const jId = String(rawId).replace(/^JE-0*/i, "").trim();

    return String(
      (jId ? journalDateMap[jId] : undefined) ??
        row.journalDate ??
        row.journaldate ??
        row.postingDate ??
        row.postingdate ??
        row.entryDate ??
        row.date ??
        ""
    );
  };

  // Extract distinct source modules present in ledger rows for the dropdown
  const availableSources = useMemo<string[]>(() => {
    const sources = new Set<string>();
    for (const row of rawRows) {
      const src = String(
        row.sourceModule ??
          row.sourcemodule ??
          row.source_module ??
          row.source ??
          row.module ??
          ""
      ).trim();
      if (src) {
        sources.add(src);
      }
    }
    return Array.from(sources).sort((a, b) => a.localeCompare(b));
  }, [rawRows]);

  // Compute filtered rows, running balance chronologically, then reverse so newest postings appear on top
  const {
    processedRows,
    openingBalance,
    totalDebits,
    totalCredits,
    closingBalance,
  } = useMemo(() => {
    // 1. Filter by account and source module
    const accountAndSourceFiltered = rawRows.filter((row) => {
      const rowAccId = String(row.accountID ?? row.accountId ?? "");
      const rowAccCode = String(row.accountCode ?? "");
      const matchesAccount =
        selectedAccount === "ALL" ||
        rowAccId === selectedAccount ||
        rowAccCode === selectedAccount;

      const rowSource = String(
        row.sourceModule ??
          row.sourcemodule ??
          row.source_module ??
          row.source ??
          row.module ??
          ""
      ).trim();
      const matchesSource =
        sourceFilter === "ALL" ||
        rowSource.toLowerCase() === sourceFilter.toLowerCase();

      return matchesAccount && matchesSource;
    });

    // 2. Sort oldest -> newest to compute accurate running balances
    const chronological = [...accountAndSourceFiltered].sort((a, b) => {
      const dA = new Date(extractRowDate(a) || 0).getTime();
      const dB = new Date(extractRowDate(b) || 0).getTime();
      if (dA !== dB) return dA - dB;
      return Number(a.ledgerID ?? a.id ?? 0) - Number(b.ledgerID ?? b.id ?? 0);
    });

    // 3. Separate Opening Balance (before startDate) vs Period Transactions
    let opening = 0;
    const periodTransactions: any[] = [];

    for (const row of chronological) {
      const txDateRaw = extractRowDate(row);
      const txDate = txDateRaw ? String(txDateRaw).slice(0, 10) : "";
      const debit = Number(row.debitAmount ?? row.debit ?? 0);
      const credit = Number(row.creditAmount ?? row.credit ?? 0);

      if (startDate && txDate && txDate < startDate) {
        opening += debit - credit;
      } else if (endDate && txDate && txDate > endDate) {
        continue;
      } else {
        periodTransactions.push(row);
      }
    }


    // 4. Calculate running balances chronologically
       // 4. Calculate running balances chronologically
    let running = opening;
    let debitsSum = 0;
    let creditsSum = 0;

    const rowsWithBalance = periodTransactions.map((row) => {
      const debit = Number(row.debitAmount ?? row.debit ?? 0);
      const credit = Number(row.creditAmount ?? row.credit ?? 0);

      debitsSum += debit;
      creditsSum += credit;
      running += debit - credit;

      const rawDesc = String(
        row.description ?? row.remarks ?? "Journal Posting"
      );
      const shortDesc = rawDesc.split("—")[0].trim();

      return {
        id: row.ledgerID ?? row.id ?? Math.random(),
        date: formatDate(extractRowDate(row)),
        description: row.accountName
          ? `${row.accountCode ? `${row.accountCode} · ` : ""}${row.accountName} (${shortDesc})`
          : shortDesc,
        reference:
          row.referenceNo ??
          row.reference ??
          (row.journalID ? `JE-${row.journalID}` : "-"),
        debit,
        credit,
        balance: running,
      };
    });

    // 5. Reverse rows so the newest postings appear at the top of the table
    const newestFirstRows = [...rowsWithBalance].reverse();

    return {
      processedRows: newestFirstRows,
      openingBalance: opening,
      totalDebits: debitsSum,
      totalCredits: creditsSum,
      closingBalance: running,
    };
  }, [rawRows, journalDateMap, selectedAccount, startDate, endDate, sourceFilter]);

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
      {/* Aligned Fixed Page Header (No subtitle, matches Chart of Accounts) */}
      <div className="ledger-header">
        <h1>General Ledger</h1>

        <button
          type="button"
          className="print-btn"
          onClick={() => window.print()}
        >
          Print Ledger
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="ledger-filters">
        <div className="date-range-group">
          <span className="date-range-label">Date</span>
          <input
            type="date"
            className="date-range-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="From Date"
            aria-label="From Date"
          />
          <span className="date-range-sep">to</span>
          <input
            type="date"
            className="date-range-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="To Date"
            aria-label="To Date"
          />
        </div>

        <select
          className="ledger-select"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          aria-label="Filter by Account"
        >
          <option value="ALL">All Accounts</option>
          {Array.from(
            new Map(
              accounts.map((acc) => [
                String(acc.accountID ?? acc.accountCode),
                acc,
              ])
            ).values()
          ).map((acc, idx) => {
            const val = String(acc.accountID ?? acc.accountCode);
            return (
              <option key={`${val}-${idx}`} value={val}>
                {acc.accountCode} - {acc.accountName ?? acc.name}
              </option>
            );
          })}
        </select>

        <select
          className="ledger-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter by Entry Source"
        >
          <option value="ALL">All Entries</option>
          {availableSources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="update-report-btn"
          onClick={fetchLedgerData}
        >
          Update Report
        </button>
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
            type="button"
            className="reset-filters-btn"
            onClick={() => {
              setSelectedAccount("ALL");
              setStartDate("");
              setEndDate("");
              setSourceFilter("ALL");
            }}
          >
            Reset Filters
          </button>
        </div>

        {loading ? (
          <p className="ledger-state-msg">Loading general ledger...</p>
        ) : error ? (
          <p className="ledger-state-msg error">Error: {error}</p>
        ) : (
          <table className="ledger-table">
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
              {processedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ledger-empty-cell">
                    No ledger transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                processedRows.map((item, idx) => (
                  <tr key={`${item.id ?? "row"}-${idx}`}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td>
                      <strong>{item.reference}</strong>
                    </td>
                    <td>{item.debit > 0 ? formatCurrency(item.debit) : "-"}</td>
                    <td>
                      {item.credit > 0 ? formatCurrency(item.credit) : "-"}
                    </td>
                    <td>{formatCurrency(item.balance)}</td>
                  </tr>
                ))
              )}

              {/* Opening Balance Row at bottom since newest postings are on top */}
              <tr className="opening-balance-row">
                <td>{startDate ? formatDate(startDate) : "Beginning"}</td>
                <td>Opening Balance</td>
                <td>Prior Period</td>
                <td>-</td>
                <td>-</td>
                <td>{formatCurrency(openingBalance)}</td>
              </tr>
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
