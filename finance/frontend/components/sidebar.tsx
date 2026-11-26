"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser, logout, type SessionUser } from "../../back up/components/AuthGate";
import "./sidebar.css";

interface DbUserProfile {
  UserID: string;
  Username: string;
  roleName: string;
  DeptID: string;
}

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUserProfile | null>(null);
  const pathname = usePathname();

  const [apOpen, setApOpen] = useState(
    pathname.startsWith("/accounts-payable")
  );
  const [cashOpen, setCashOpen] = useState(
    pathname.startsWith("/cash-bank")
  );
  const [reportsOpen, setReportsOpen] = useState(
    pathname.startsWith("/reports")
  );

  // Read the authenticated user session and load matching profile from public."User"
  useEffect(() => {
    const tokenUser = getUser();
    setUser(tokenUser);

    const API_URL = (
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    const query = tokenUser?.sub
      ? `?user_id=${encodeURIComponent(tokenUser.sub)}`
      : tokenUser?.username
      ? `?username=${encodeURIComponent(tokenUser.username)}`
      : "";

    // FETCH: GET ${API_URL}/api/me
    // Backend Route: finance/backend/main.py -> get_current_user_profile()
    // Database Table: Reads public."User"
    // Purpose: Loads real Username, Role, and DeptID for the Sidebar footer
    fetch(`${API_URL}/api/me${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.Username) setDbUser(data);
      })
      .catch(() => {});
  }, []);

  // Generate display name, role, and 2-letter avatar initials
  const displayName = dbUser?.Username || user?.username || "Finance User";
  const displayRole = dbUser
    ? `${dbUser.roleName} · ${dbUser.DeptID}`
    : user?.role
    ? `${user.role}${user.department ? ` · ${user.department}` : ""}`
    : "Finance Staff";

  const initials =
    displayName
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.toUpperCase())
      .join("") || "FN";

  return (

    <nav className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
      {/* Sidebar Header & Logo */}
      <header>
        <div className="sidebar-logo">
          <div className="logo-img-box">
            <img src="/logo.png" alt="Computer ERP Logo" className="logo-img" />
          </div>

          <div className="logo-text">
            <h2>Finance</h2>
            <span>ACCOUNTING</span>
          </div>
        </div>

        <div
          className={`bx bx-chevron-${sidebarOpen ? "left" : "right"} toggle`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        ></div>
      </header>

      {/* Main Navigation Links */}
      <ul className="menu-links">
        {/* Dashboard */}
        <li className={`nav-link ${pathname === "/" ? "active-link" : ""}`}>
          <Link href="/">
            <i className="bx bx-grid-alt icon"></i>
            <span className="text nav-text">Dashboard</span>
          </Link>
        </li>

        {/* Chart of Accounts */}
        <li
          className={`nav-link ${
            pathname === "/chart-of-accounts" ? "active-link" : ""
          }`}
        >
          <Link href="/chart-of-accounts">
            <i className="bx bx-list-ul icon"></i>
            <span className="text nav-text">Chart of Accounts</span>
          </Link>
        </li>

        {/* Journal Entries */}
        <li
          className={`nav-link ${
            pathname === "/journal-entries" ? "active-link" : ""
          }`}
        >
          <Link href="/journal-entries">
            <i className="bx bx-book icon"></i>
            <span className="text nav-text">Journal Entries</span>
          </Link>
        </li>

        {/* General Ledger */}
        <li
          className={`nav-link ${
            pathname === "/general-ledger" ? "active-link" : ""
          }`}
        >
          <Link href="/general-ledger">
            <i className="bx bx-book-content icon"></i>
            <span className="text nav-text">General Ledger</span>
          </Link>
        </li>

        {/* Accounts Payable */}
        <li className="nav-link parent-menu">
          <div className="menu-parent" onClick={() => setApOpen(!apOpen)}>
            <i className="bx bx-up-arrow-alt icon"></i>
            <span className="text nav-text">Accounts Payable</span>

            <i
              className={`bx ${
                apOpen ? "bx-chevron-down" : "bx-chevron-right"
              } arrow`}
            ></i>
          </div>

          {apOpen && (
            <ul className="sub-menu">
              <li
                className={
                  pathname === "/accounts-payable/invoices"
                    ? "active-link"
                    : ""
                }
              >
                <Link href="/accounts-payable/invoices">AP Invoices</Link>
              </li>
              <li
                className={
                  pathname === "/accounts-payable/payments"
                    ? "active-link"
                    : ""
                }
              >
                <Link href="/accounts-payable/payments">AP Payments</Link>
              </li>
            </ul>
          )}
        </li>

        {/* Accounts Receivable */}
        <li
          className={`nav-link ${
            pathname.startsWith("/accounts-receivable") ? "active-link" : ""
          }`}
        >
          <Link href="/accounts-receivable">
            <i className="bx bx-down-arrow-alt icon"></i>
            <span className="text nav-text">Accounts Receivable</span>
          </Link>
        </li>

        {/* Cash & Bank */}
        <li className="nav-link parent-menu">
          <div className="menu-parent" onClick={() => setCashOpen(!cashOpen)}>
            <i className="bx bx-buildings icon"></i>
            <span className="text nav-text">Cash &amp; Bank</span>

            <i
              className={`bx ${
                cashOpen ? "bx-chevron-down" : "bx-chevron-right"
              } arrow`}
            ></i>
          </div>

          {cashOpen && (
            <ul className="sub-menu">
              <li
                className={
                  pathname === "/cash-bank/accounts" ? "active-link" : ""
                }
              >
                <Link href="/cash-bank/accounts">Bank Accounts</Link>
              </li>
              <li
                className={
                  pathname === "/cash-bank/transactions" ? "active-link" : ""
                }
              >
                <Link href="/cash-bank/transactions">Transactions</Link>
              </li>
            </ul>
          )}
        </li>

        {/* Expenses */}
        <li
          className={`nav-link ${
            pathname === "/expenses" ? "active-link" : ""
          }`}
        >
          <Link href="/expenses">
            <i className="bx bx-receipt icon"></i>
            <span className="text nav-text">Expenses</span>
          </Link>
        </li>

        {/* Reports */}
        <li className="nav-link parent-menu">
          <div
            className="menu-parent"
            onClick={() => setReportsOpen(!reportsOpen)}
          >
            <i className="bx bx-bar-chart-alt-2 icon"></i>
            <span className="text nav-text">Reports</span>

            <i
              className={`bx ${
                reportsOpen ? "bx-chevron-down" : "bx-chevron-right"
              } arrow`}
            ></i>
          </div>

          {reportsOpen && (
            <ul className="sub-menu">
              <li
                className={
                  pathname === "/reports/trial-balance" ? "active-link" : ""
                }
              >
                <Link href="/reports/trial-balance">Trial Balance</Link>
              </li>

              <li
                className={
                  pathname === "/reports/income-statement"
                    ? "active-link"
                    : ""
                }
              >
                <Link href="/reports/income-statement">Income Statement</Link>
              </li>

              <li
                className={
                  pathname === "/reports/balance-sheet" ? "active-link" : ""
                }
              >
                <Link href="/reports/balance-sheet">Balance Sheet</Link>
              </li>

              <li
                className={
                  pathname === "/reports/cash-flow" ? "active-link" : ""
                }
              >
                <Link href="/reports/cash-flow">Cash Flow Statement</Link>
              </li>

              <li
                className={
                  pathname === "/reports/AP-aging" ? "active-link" : ""
                }
              >
                <Link href="/reports/AP-aging">AP Aging</Link>
              </li>

              <li
                className={
                  pathname === "/reports/AR-aging" ? "active-link" : ""
                }
              >
                <Link href="/reports/AR-aging">AR Aging</Link>
              </li>
            </ul>
          )}
        </li>
      </ul>

       <div className="sidebar-footer">
        <div className="user-box">
          <div className="avatar" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className="avatar-silhouette"
            >
              <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
            </svg>
          </div>

          <div className="user-info">
            <strong>{displayName}</strong>
            <small>{displayRole}</small>
          </div>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={logout}
          title="Log out and return to Computer ERP Login"
        >
          <i className="bx bx-log-out"></i>
          <span className="logout-text">Log Out</span>
        </button>
      </div>
    </nav>
  );
}
