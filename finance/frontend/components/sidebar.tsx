"use client";

import React, { useState } from "react";
import Link from "next/link";

import { usePathname } from "next/navigation";
import "./sidebar.css";

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();



const [apOpen, setApOpen] = useState(false);
const [arOpen, setArOpen] = useState(false);
const [cashOpen, setCashOpen] = useState(false);
const [reportsOpen, setReportsOpen] = useState(false);















  return (
    <nav className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
      <header>
        <div className="sidebar-logo">
          <div className="logo-icon">F</div>

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

      <ul className="menu-links">

        <li className={`nav-link ${pathname === "/" ? "active-link" : ""}`}>
          <Link href="/">
            <i className="bx bx-grid-alt icon"></i>
            <span className="text nav-text">Dashboard</span>
          </Link>
        </li>

        <li
          className={`nav-link ${
            pathname === "/chart-of-accounts"
              ? "active-link"
              : ""
          }`}
        >
          <Link href="/chart-of-accounts">
            <i className="bx bx-list-ul icon"></i>
            <span className="text nav-text">
              Chart of Accounts
            </span>
          </Link>
        </li>

        <li
          className={`nav-link ${
            pathname === "/journal-entries"
              ? "active-link"
              : ""
          }`}
        >
          <Link href="/journal-entries">
            <i className="bx bx-book icon"></i>
            <span className="text nav-text">
              Journal Entries
            </span>
          </Link>
        </li>

        <li
          className={`nav-link ${
            pathname === "/general-ledger"
              ? "active-link"
              : ""
          }`}
        >
          <Link href="/general-ledger">
            <i className="bx bx-book-content icon"></i>
            <span className="text nav-text">
              General Ledger
            </span>
          </Link>
        </li>
















        {/* Accounts Payable */}
<li className="nav-link parent-menu">
  <div
    className="menu-parent"
    onClick={() => setApOpen(!apOpen)}
  >
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
      <li>
        <Link href="/accounts-payable/invoices">
          AP Invoices
        </Link>
      </li>
      <li>
        <Link href="/accounts-payable/payments">
          AP Payments
        </Link>
      </li>
    </ul>
  )}
</li>






       {/* Accounts Receivable */}
<li className="nav-link parent-menu">
  <div
    className="menu-parent"
    onClick={() => setArOpen(!arOpen)}
  >
    <i className="bx bx-down-arrow-alt icon"></i>
    <span className="text nav-text">Accounts Receivable</span>

    <i
      className={`bx ${
        arOpen ? "bx-chevron-down" : "bx-chevron-right"
      } arrow`}
    ></i>
  </div>

  {arOpen && (
    <ul className="sub-menu">
      <li>
        <Link href="/accounts-receivable/invoices">
          AR Invoices
        </Link>
      </li>
      <li>
        <Link href="/accounts-receivable/collections">
          Collections
        </Link>
      </li>
    </ul>
  )}
</li>

        {/* Cash & Bank */}
<li className="nav-link parent-menu">
  <div
    className="menu-parent"
    onClick={() => setCashOpen(!cashOpen)}
  >
    <i className="bx bx-buildings icon"></i>
    <span className="text nav-text">Cash & Bank</span>

    <i
      className={`bx ${
        cashOpen ? "bx-chevron-down" : "bx-chevron-right"
      } arrow`}
    ></i>
  </div>

  {cashOpen && (
    <ul className="sub-menu">
      <li>
        <Link href="/cash-bank/accounts">
          Bank Accounts
        </Link>
      </li>
      <li>
        <Link href="/cash-bank/transactions">
          Transactions
        </Link>
      </li>
    </ul>
  )}
</li>

        {/* Expenses */}
        <li className="nav-link">
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
      <li>
        <Link href="/reports/trial-balance">
          Trial Balance
        </Link>
      </li>

      <li>
        <Link href="/reports/income-statement">
          Income Statement
        </Link>
      </li>

      <li>
        <Link href="/reports/balance-sheet">
          Balance Sheet
        </Link>
      </li>

      <li>
        <Link href="/reports/cash-flow">
          Cash Flow Statement
        </Link>
      </li>

      <li>
        <Link href="/reports/AP-aging">
          AP Aging
        </Link>
      </li>

      <li>
        <Link href="/reports/AR-aging">
          AR Aging
        </Link>
      </li>
    </ul>
  )}
</li>
        
        

      </ul>

      

      <div className="sidebar-footer">
        <div className="help-link">
          <i className="bx bx-help-circle"></i>
          Help & Resources
        </div>

        <div className="user-box">
          <div className="avatar">HA</div>

          <div className="user-info">
            <strong>Hev Adie</strong>
            <small>Administrator</small>
          </div>
        </div>
      </div>
    </nav>
  );
}