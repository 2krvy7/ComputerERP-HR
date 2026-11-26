"use client";

import { useEffect, useMemo, useState } from "react";
import "./accounts.css";

// Sorts statement transactions newest-first (latest date and highest numeric ID on top)
function sortLatestFirst(rows: any[]) {
  return [...rows].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    const numA = Number(String(a.id ?? "").replace(/\D/g, "")) || 0;
    const numB = Number(String(b.id ?? "").replace(/\D/g, "")) || 0;
    return numB - numA;
  });
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Reconciliation
  const [bankFilter, setBankFilter] = useState("ALL");
  const [reconciledIds, setReconciledIds] = useState<number[]>([]);

  // Per-Bank Statement Filter
  const [statementBankId, setStatementBankId] = useState<number | "ALL">("ALL");
  const [statementLines, setStatementLines] = useState<any[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);

  // Add Bank Account Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formBankName, setFormBankName] = useState("");
  const [formAccountNum, setFormAccountNum] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Transfer Sales Funds to Corporate Checking Modal
  const [transferSourceBank, setTransferSourceBank] = useState<any | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferring, setTransferring] = useState(false);

  // View Transactions Modal
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  useEffect(() => {
    setTransferDate(new Date().toISOString().split("T")[0]);
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      // FETCH 1: GET ${API_URL}/api/bank
      // Backend File: finance/backend/routers/bank.py -> get_bank_accounts()
      // Database Tables: Reads "BankAccount" with "isDisbursement" & "isReceiver" flags and aggregates "ARReceipt" & "APPayment"
      // Purpose: Loads all registered bank accounts, live balances, and role statuses
      const res = await fetch(`${API_URL}/api/bank`);
      if (!res.ok) throw new Error(`Bank API error: ${res.status}`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }

    // Philippine Peso (PHP) currency formatter
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val || 0));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Identify BDO Corporate Checking as the target bank for Sales sweeps
  const corporateCheckingBank = useMemo(() => {
    return (
      accounts.find((a) =>
        String(a.bankName || "").toLowerCase().includes("bdo")
      ) ||
      accounts.find((a) => Boolean(a.isDisbursement)) ||
      null
    );
  }, [accounts]);

  const stats = useMemo(() => {
    const totalCash = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalInflows = accounts.reduce((s, a) => s + Number(a.totalIn || 0), 0);
    const totalOutflows = accounts.reduce(
      (s, a) => s + Number(a.totalOut || 0),
      0
    );
    const activeDisbCount = accounts.filter((a) =>
      Boolean(a.isDisbursement)
    ).length;
    const needsRecon = accounts.filter(
      (a) => !reconciledIds.includes(a.bankAccountID)
    ).length;

    return {
      totalCash,
      totalInflows,
      totalOutflows,
      activeDisbCount,
      needsRecon,
    };
  }, [accounts, reconciledIds]);

  const filteredAccounts = useMemo(() => {
    if (bankFilter === "ALL") return accounts;
    return accounts.filter((a) => a.bankName === bankFilter);
  }, [accounts, bankFilter]);

  async function handleSelectBankStatement(account: any) {
    setStatementBankId(account.bankAccountID);
    setStatementLoading(true);
    try {
      // FETCH 2: GET ${API_URL}/api/bank/${account.bankAccountID}/transactions
      // Backend File: finance/backend/routers/bank.py -> get_bank_transactions()
      // Database Tables: Reads "ARReceipt" and "APPayment" for the clicked bankAccountID
      // Purpose: Filters the Bank Statements table below to show only this specific bank's entries (latest on top)
      const res = await fetch(
        `${API_URL}/api/bank/${account.bankAccountID}/transactions`
      );
      if (res.ok) {
        const raw = await res.json();
        setStatementLines(sortLatestFirst(Array.isArray(raw) ? raw : []));
      } else {
        setStatementLines([]);
      }
    } catch {
      setStatementLines([]);
    } finally {
      setStatementLoading(false);
    }
  }

  async function handleToggleRole(
    e: React.MouseEvent,
    account: any,
    role: "isDisbursement" | "isReceiver"
  ) {
    e.stopPropagation();
    const nextDisb =
      role === "isDisbursement"
        ? !Boolean(account.isDisbursement)
        : Boolean(account.isDisbursement);
    const nextRec =
      role === "isReceiver"
        ? !Boolean(account.isReceiver)
        : Boolean(account.isReceiver);

    try {
      // FETCH 3: PATCH ${API_URL}/api/bank/${account.bankAccountID}/roles
      // Backend File: finance/backend/routers/bank.py -> update_bank_roles()
      // Database Table: Updates "BankAccount" ("isDisbursement", "isReceiver")
      // Purpose: Turns Disbursement (for BDO) or Receiver (for BPI Sales) ON or OFF
      const res = await fetch(
        `${API_URL}/api/bank/${account.bankAccountID}/roles`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isDisbursement: nextDisb,
            isReceiver: nextRec,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update bank account role");
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message || "Error updating bank role");
    }
  }

  async function handleTransferToCorporate(e: React.FormEvent) {
    e.preventDefault();
    if (!transferSourceBank || !corporateCheckingBank) return;
    const amt = Number(transferAmount);
    if (amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setTransferring(true);
    try {
      // FETCH 4: POST ${API_URL}/api/bank/transfer
      // Backend File: finance/backend/routers/bank.py -> transfer_between_banks()
      // Database Tables: Deducts outflow from BPI Sales, deposits inflow into BDO Corporate Checking, and posts a Journal Entry
      // Purpose: Transfers collected sales money from BPI Sales into BDO Corporate Checking
      const res = await fetch(`${API_URL}/api/bank/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBankID: transferSourceBank.bankAccountID,
          toBankID: corporateCheckingBank.bankAccountID,
          amount: amt,
          transferDate,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Transfer failed");
      }

      const currentStmtId = statementBankId;
      setTransferSourceBank(null);
      setTransferAmount("");
      await fetchAccounts();
      if (currentStmtId !== "ALL") {
        const refreshed = accounts.find(
          (a) => a.bankAccountID === currentStmtId
        );
        if (refreshed) await handleSelectBankStatement(refreshed);
      }
    } catch (err: any) {
      alert(err.message || "Error transferring funds");
    } finally {
      setTransferring(false);
    }
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!formBankName.trim() || !formAccountNum.trim()) return;

    setSubmitting(true);
    try {
      // FETCH 5: POST ${API_URL}/api/bank
      // Backend File: finance/backend/routers/bank.py -> create_bank_account()
      // Database Table: Inserts new bank record into "BankAccount"
      const res = await fetch(`${API_URL}/api/bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: formBankName,
          accountNumber: formAccountNum,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to add bank account");
      }
      setShowAddModal(false);
      setFormBankName("");
      setFormAccountNum("");
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewTransactions(e: React.MouseEvent, account: any) {
    e.stopPropagation();
    setSelectedAccount(account);
    setTxLoading(true);
    try {
      // FETCH 6: GET ${API_URL}/api/bank/${account.bankAccountID}/transactions
      // Backend File: finance/backend/routers/bank.py -> get_bank_transactions()
      const res = await fetch(
        `${API_URL}/api/bank/${account.bankAccountID}/transactions`
      );
      if (res.ok) {
        const raw = await res.json();
        setTransactions(sortLatestFirst(Array.isArray(raw) ? raw : []));
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }

  function toggleReconcile(e: React.MouseEvent, bankAccountID: number) {
    e.stopPropagation();
    setReconciledIds((prev) =>
      prev.includes(bankAccountID)
        ? prev.filter((id) => id !== bankAccountID)
        : [...prev, bankAccountID]
    );
  }


    return (
    <div className="bank-page">
      {/* Aligned Fixed Header (No subtitle, no Export button) */}
      <div className="page-header">
        <h1>Bank Accounts</h1>

        <div className="header-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowAddModal(true)}
          >
            Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Cash Balance</span>
          <h2>{loading ? "..." : formatCurrency(stats.totalCash)}</h2>
          <small>
            In: {formatCurrency(stats.totalInflows)} • Out:{" "}
            {formatCurrency(stats.totalOutflows)}
          </small>
        </div>

        <div className="stat-card">
          <span>Active Disbursement Accounts</span>
          <h2>{loading ? "..." : stats.activeDisbCount}</h2>
          <small>Corporate Checking disbursements</small>
        </div>

        <div className="stat-card">
          <span>Needs Reconciliation</span>
          <h2>{loading ? "..." : stats.needsRecon}</h2>
          <small>
            {stats.needsRecon === 0
              ? "All accounts reconciled"
              : "Pending statement review"}
          </small>
        </div>

        <div className="stat-card">
          <span>Sync Status</span>
          <h2>Live</h2>
          <small>Connected to AR &amp; AP feeds</small>
        </div>
      </div>

      {/* Institution Filter Bar */}
      <div className="filters">
        <button
          type="button"
          className={bankFilter === "ALL" ? "filter-btn active" : "filter-btn"}
          onClick={() => setBankFilter("ALL")}
        >
          All Institutions
        </button>
        {Array.from(new Set(accounts.map((a) => a.bankName))).map((name) => (
          <button
            key={name}
            type="button"
            className={bankFilter === name ? "filter-btn active" : "filter-btn"}
            onClick={() => setBankFilter(name)}
          >
            {name}
          </button>
        ))}

        <button
          type="button"
          className="more-filter"
          onClick={fetchAccounts}
        >
          Refresh Feed
        </button>
      </div>

      {/* Bank Cards Grid */}
      {loading ? (
        <p className="state-message">Loading bank accounts...</p>
      ) : error ? (
        <p className="state-message error">Error: {error}</p>
      ) : filteredAccounts.length === 0 ? (
        <p className="state-message">
          No bank accounts found. Click <strong>Add Account</strong> to register
          one.
        </p>
      ) : (
        <div className="accounts-grid">
          {filteredAccounts.map((account) => {
            const isRecon = reconciledIds.includes(account.bankAccountID);
            const nameLower = String(account.bankName || "").toLowerCase();
            const isBDO = nameLower.includes("bdo");
            const isSalesBank = nameLower.includes("sales");
            const isSelectedStmt = statementBankId === account.bankAccountID;

            return (
              <div
                key={account.bankAccountID}
                className={`account-card ${
                  isSelectedStmt ? "selected-stmt" : ""
                }`}
                onClick={() => handleSelectBankStatement(account)}
              >
                <div className="card-header">
                  <div>
                    <h3>{account.bankName}</h3>
                    <span>Account #{account.bankAccountID}</span>
                  </div>

                  <button
                    type="button"
                    className="menu-btn"
                    onClick={(e) => handleViewTransactions(e, account)}
                    title="View Transactions"
                  >
                    •••
                  </button>
                </div>

                <div className="balance">{formatCurrency(account.balance)}</div>

                <p className="account-meta">
                  Acct No: {account.accountNumber} • {account.transactionCount}{" "}
                  posted txns
                </p>

                <div className="status-row">
                  {isBDO && (
                    <span
                      className={`badge ${
                        account.isDisbursement ? "disb-on" : "role-off"
                      }`}
                    >
                      {account.isDisbursement
                        ? "Disbursement: Active"
                        : "Disbursement: Off"}
                    </span>
                  )}

                  {isSalesBank && (
                    <span
                      className={`badge ${
                        account.isReceiver ? "" : "role-off"
                      }`}
                    >
                      {account.isReceiver
                        ? "Receiver: Active"
                        : "Receiver: Off"}
                    </span>
                  )}

                  <span className="badge">
                    {isRecon ? "Reconciled" : "Tap for Statement"}
                  </span>
                </div>

                <div className="card-actions">
                  {isBDO && (
                    <button
                      type="button"
                      className={`btn secondary ${
                        account.isDisbursement ? "disb-btn-active" : ""
                      }`}
                      onClick={(e) =>
                        handleToggleRole(e, account, "isDisbursement")
                      }
                    >
                      {account.isDisbursement
                        ? "Disbursement: ON ✓"
                        : "Disbursement: OFF"}
                    </button>
                  )}

                  {isSalesBank && (
                    <>
                      <button
                        type="button"
                        className={`btn secondary ${
                          account.isReceiver ? "rec-btn-active" : ""
                        }`}
                        onClick={(e) =>
                          handleToggleRole(e, account, "isReceiver")
                        }
                      >
                        {account.isReceiver
                          ? "Receiver: ON ✓"
                          : "Receiver: OFF"}
                      </button>

                      <button
                        type="button"
                        className="btn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransferSourceBank(account);
                          setTransferAmount(
                            account.balance > 0 ? String(account.balance) : ""
                          );
                        }}
                      >
                        Send to Corporate Checking
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={(e) => toggleReconcile(e, account.bankAccountID)}
                  >
                    {isRecon ? "Unmark" : "Reconcile"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Bank Statements (Latest entries on top) */}
      <div className="statements-card">
        <div className="table-header">
          <div>
            <h3>
              {statementBankId === "ALL"
                ? "Bank Statements (All Accounts)"
                : `Bank Statement — ${
                    accounts.find((a) => a.bankAccountID === statementBankId)
                      ?.bankName || `Account #${statementBankId}`
                  }`}
            </h3>
            <p>
              {statementBankId === "ALL"
                ? "Tap any bank card above to view only that bank's statement."
                : "Showing posted statement entries for the selected bank only (latest on top)."}
            </p>
          </div>

          <div className="table-header-actions">
            {statementBankId !== "ALL" && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setStatementBankId("ALL");
                  setStatementLines([]);
                }}
              >
                Show All Banks
              </button>
            )}
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                fetchAccounts();
                if (statementBankId !== "ALL") {
                  const activeBank = accounts.find(
                    (a) => a.bankAccountID === statementBankId
                  );
                  if (activeBank) handleSelectBankStatement(activeBank);
                }
              }}
            >
              Sync Balances
            </button>
          </div>
        </div>

        {statementBankId === "ALL" ? (
          <table className="statements-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Cash Inflows / Outflows</th>
                <th>Closing Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    No bank statements available yet.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isRecon = reconciledIds.includes(acc.bankAccountID);
                  return (
                    <tr
                      key={acc.bankAccountID}
                      className="clickable-row"
                      onClick={() => handleSelectBankStatement(acc)}
                    >
                      <td>
                        <strong>{acc.bankName}</strong> - {acc.accountNumber}
                      </td>
                      <td>
                        +{formatCurrency(acc.totalIn)} / -
                        {formatCurrency(acc.totalOut)}
                      </td>
                      <td>
                        <strong>{formatCurrency(acc.balance)}</strong>
                      </td>
                      <td>
                        <span
                          className={
                            isRecon ? "status success" : "status warning"
                          }
                        >
                          {isRecon
                            ? "Reconciled"
                            : `${acc.transactionCount} txns to review`}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectBankStatement(acc);
                          }}
                        >
                          View Statement
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : statementLoading ? (
          <p className="state-message">Loading statement lines...</p>
        ) : (
          <table className="statements-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Description / Type</th>
                <th>Reference</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {statementLines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    No statement entries recorded for this specific bank yet.
                  </td>
                </tr>
              ) : (
                statementLines.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.date)}</td>
                    <td>
                      <strong>{tx.id}</strong>
                    </td>
                    <td>{tx.type}</td>
                    <td>{tx.reference}</td>
                    <td
                      className={
                        tx.direction === "IN"
                          ? "tx-amount-in"
                          : "tx-amount-out"
                      }
                    >
                      {tx.direction === "IN" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Collected Sales Money to BDO Corporate Checking Modal */}
      {transferSourceBank && (
        <div className="modal-overlay">
          <form className="modal-box" onSubmit={handleTransferToCorporate}>
            <h3>Send Funds to Corporate Checking</h3>
            <p className="modal-subtext">
              <strong>From:</strong> {transferSourceBank.bankName} (Available:{" "}
              {formatCurrency(transferSourceBank.balance)})
            </p>
            <p className="modal-subtext">
              <strong>To:</strong>{" "}
              {corporateCheckingBank
                ? `${corporateCheckingBank.bankName} (${corporateCheckingBank.accountNumber})`
                : "BDO Corporate Checking (Please register BDO first)"}
            </p>

            <label className="modal-label">Transfer Date *</label>
            <input
              type="date"
              className="modal-input"
              required
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
            />

            <label className="modal-label">Amount to Send *</label>
            <input
              type="number"
              step="0.01"
              className="modal-input"
              required
              placeholder="0.00"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setTransferSourceBank(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={transferring || !corporateCheckingBank}
              >
                {transferring ? "Sending..." : "Confirm Transfer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <form className="modal-box" onSubmit={handleAddAccount}>
            <h3>Add Bank Account</h3>

            <label className="modal-label">Bank Name *</label>
            <input
              type="text"
              className="modal-input"
              required
              placeholder="e.g. BDO Corporate Checking"
              value={formBankName}
              onChange={(e) => setFormBankName(e.target.value)}
            />

            <label className="modal-label">Account Number *</label>
            <input
              type="text"
              className="modal-input"
              required
              placeholder="e.g. 0048-2910-4821"
              value={formAccountNum}
              onChange={(e) => setFormAccountNum(e.target.value)}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Transactions Modal */}
      {selectedAccount && (
        <div className="modal-overlay">
          <div className="modal-box tx-modal">
            <h3>
              {selectedAccount.bankName} ({selectedAccount.accountNumber})
            </h3>
            <p className="modal-subtext">
              <strong>Current Balance:</strong>{" "}
              {formatCurrency(selectedAccount.balance)}
            </p>

            {txLoading ? (
              <p className="state-message">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="state-message">
                No AP payments or AR receipts recorded on this account yet.
              </p>
            ) : (
              <table className="statements-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Ref</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <strong>{tx.id}</strong>
                      </td>
                      <td>{tx.type}</td>
                      <td>{tx.reference}</td>
                      <td>{formatDate(tx.date)}</td>
                      <td
                        className={
                          tx.direction === "IN"
                            ? "tx-amount-in"
                            : "tx-amount-out"
                        }
                      >
                        {tx.direction === "IN" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelectedAccount(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
