"use client";

import React, { useState } from "react";
import Link from "next/link";

import { usePathname } from "next/navigation";
import "./sidebar.css";

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

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
          <Link href="/accounts-payable">
            <i className="bx bx-up-arrow-alt icon"></i>
            <span className="text nav-text">Accounts Payable</span>
          </Link>

          <ul className="sub-menu">
            <li>
              <Link href="/accounts-payable/invoices">
                <span className="text nav-text">AP Invoices</span>
              </Link>
            </li>
            <li>
              <Link href="/accounts-payable/payments">
                <span className="text nav-text">AP Payments</span>
              </Link>
            </li>
          </ul>
        </li>

        {/* Accounts Receivable */}
        <li className="nav-link parent-menu">
          <Link href="/accounts-receivable">
            <i className="bx bx-down-arrow-alt icon"></i>
            <span className="text nav-text">Accounts Receivable</span>
          </Link>

          <ul className="sub-menu">
            <li>
              <Link href="/accounts-receivable/invoices">
                <span className="text nav-text">AR Invoices</span>
              </Link>
            </li>
            <li>
              <Link href="/accounts-receivable/collections">
                <span className="text nav-text">Collections</span>
              </Link>
            </li>
          </ul>
        </li>

        {/* Cash & Bank */}
        <li className="nav-link parent-menu">
          <Link href="/cash-bank">
            <i className="bx bx-buildings icon"></i>
            <span className="text nav-text">Cash & Bank</span>
          </Link>

          <ul className="sub-menu">
            <li>
              <Link href="/cash-bank/accounts">
                <span className="text nav-text">Bank Accounts</span>
              </Link>
            </li>
            <li>
              <Link href="/cash-bank/transactions">
                <span className="text nav-text">Transactions</span>
              </Link>
            </li>
          </ul>
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
          <Link href="/reports">
            <i className="bx bx-bar-chart-alt-2 icon"></i>
            <span className="text nav-text">Reports</span>
          </Link>

          <ul className="sub-menu">
            <li>
              <Link href="/reports/trial-balance">
                <span className="text nav-text">Trial Balance</span>
              </Link>
            </li>
            <li>
              <Link href="/reports/income-statement">
                <span className="text nav-text">Income Statement</span>
              </Link>
            </li>
            <li>
              <Link href="/reports/balance-sheet">
                <span className="text nav-text">Balance Sheet</span>
              </Link>
            </li>
            <li>
              <Link href="/reports/cash-flow">
                <span className="text nav-text">Cash Flow Statement</span>
              </Link>
            </li>
            <li>
              <Link href="/reports/ap-aging">
                <span className="text nav-text">AP Aging</span>
              </Link>
            </li>
            <li>
              <Link href="/reports/ar-aging">
                <span className="text nav-text">AR Aging</span>
              </Link>
            </li>
          </ul>
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