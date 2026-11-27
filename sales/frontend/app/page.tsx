
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  paymentCollectionAPI,
  salesOrderAPI,
  invoiceAPI,
  accountsReceivableAPI,
  salesReturnAPI,
  onHandStockAPI,
} from "../lib/api";

import type { OnHandStock } from "../lib/api";
import type { Collection } from "../types/payment";
import type { SalesOrder, SalesOrderItem } from "../types/order";
import type { SalesInvoice } from "../types/invoice";
import type { AccountsReceivable } from "../types/accounts-receivable";
import type { SalesReturn } from "../types/return";

const PAGE_TITLE = "Sales Analytics";

const money = (value: string | number | null | undefined) => {
  const amount = Number(value ?? 0);

  return `₱${(Number.isFinite(amount) ? amount : 0).toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
};

const numberValue = (
  value: string | number | null | undefined
) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const getMonthKey = (value: string | null | undefined) => {
  if (!value) return "";
  return value.split("T")[0].slice(0, 7);
};

const getLastSixMonths = (currentDate: Date) => {
  const months: { key: string; label: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - i,
      1
    );

    months.push({
      key: `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      }),
    });
  }

  return months;
};

const cardClass =
  "min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5";

export default function DashboardPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);

  const [stocks, setStocks] = useState<OnHandStock[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [stockSearch, setStockSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        orderData,
        invoiceData,
        collectionData,
        receivableData,
        returnData,
        itemData,
      ] = await Promise.all([
        salesOrderAPI.getAll(),
        invoiceAPI.getAll(),
        paymentCollectionAPI.getAll(),
        accountsReceivableAPI.getAll(),
        salesReturnAPI.getAll(),
        salesOrderAPI.getItems(""),
      ]);

      setOrders(orderData);
      setInvoices(invoiceData);
      setCollections(collectionData);
      setReceivables(receivableData);
      setReturns(returnData);
      setItems(itemData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load sales analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStocks = useCallback(async () => {
    try {
      setStockLoading(true);
      setStockError("");

      const stockData = await onHandStockAPI.getAll();

      setStocks(stockData);
    } catch (err) {
      setStockError(
        err instanceof Error
          ? err.message
          : "Unable to load on-hand stocks."
      );
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadStocks();
  }, [loadDashboard, loadStocks]);

  const analytics = useMemo(() => {
    const totalSales = invoices.reduce(
      (sum, invoice) =>
        sum + numberValue(invoice.total_due),
      0
    );

    const totalCollections = collections.reduce(
      (sum, collection) =>
        sum + numberValue(collection.amount_paid),
      0
    );

    const outstandingBalance = receivables.reduce(
      (sum, record) =>
        sum + numberValue(record.balance),
      0
    );

    const totalReturns = returns.reduce(
      (sum, record) =>
        sum + numberValue(record.return_amount),
      0
    );

    const activeOrders = orders.filter(
      (order) => order.status !== "Cancelled"
    );

    const orderStatuses = ["Pending", "Accepted"].map(
      (status) => ({
        status,
        count: orders.filter((order) =>
          status === "Accepted"
            ? ["Accepted", "Approved"].includes(order.status)
            : order.status === status
        ).length,
      })
    );

    const overdueAccounts = receivables.filter(
      (record) =>
        numberValue(record.balance) > 0 &&
        record.status?.toLowerCase() === "overdue"
    ).length;

    return {
      totalSales,
      totalCollections,
      outstandingBalance,
      totalReturns,
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      orderStatuses,
      overdueAccounts,
    };
  }, [orders, invoices, collections, receivables, returns]);

  const monthlyAnalytics = useMemo(() => {
    if (!currentDate) return [];

    const months = getLastSixMonths(currentDate);

    return months.map((month) => {
      const monthlySales = invoices
        .filter(
          (invoice) =>
            getMonthKey(invoice.invoice_date) === month.key
        )
        .reduce(
          (sum, invoice) =>
            sum + numberValue(invoice.total_due),
          0
        );

      const monthlyCollections = collections
        .filter(
          (collection) =>
            getMonthKey(collection.payment_date) === month.key
        )
        .reduce(
          (sum, collection) =>
            sum + numberValue(collection.amount_paid),
          0
        );

      return {
        ...month,
        sales: monthlySales,
        collections: monthlyCollections,
      };
    });
  }, [currentDate, invoices, collections]);

  const topProducts = useMemo(() => {
    const productMap = new Map<
      number,
      {
        IM_ID: number;
        name: string;
        quantity: number;
        sales: number;
      }
    >();

    const detailMap = new Map<
      number,
      { IM_ID: number; quantity: number; lineTotal: number }
    >();

    const itemMap = new Map(
      items.map((item) => [item.IM_ID, item])
    );

    const returnedQuantities = new Map<number, number>();
    const returnedAmounts = new Map<number, number>();

    returns.forEach((record) => {
      const detailId = record.Order_Detail_ID;

      returnedQuantities.set(
        detailId,
        (returnedQuantities.get(detailId) ?? 0) +
          numberValue(record.quantity)
      );

      returnedAmounts.set(
        detailId,
        (returnedAmounts.get(detailId) ?? 0) +
          numberValue(record.return_amount)
      );
    });

    orders
      .filter((order) => order.status !== "Cancelled")
      .forEach((order) => {
        order.details?.forEach((detail) => {
          detailMap.set(detail.order_detail_id, {
            IM_ID: detail.IM_ID,
            quantity: numberValue(detail.quantity),
            lineTotal: numberValue(detail.line_total),
          });
        });
      });

    detailMap.forEach((detail, detailId) => {
      const item = itemMap.get(detail.IM_ID);
      const returnedQty =
        returnedQuantities.get(detailId) ?? 0;
      const returnedAmount =
        returnedAmounts.get(detailId) ?? 0;

      const netQuantity = Math.max(
        0,
        detail.quantity - returnedQty
      );

      const netSales = Math.max(
        0,
        detail.lineTotal - returnedAmount
      );

      const existing = productMap.get(detail.IM_ID);

      if (existing) {
        existing.quantity += netQuantity;
        existing.sales += netSales;
      } else {
        productMap.set(detail.IM_ID, {
          IM_ID: detail.IM_ID,
          name: item?.Item_Name ?? `Item #${detail.IM_ID}`,
          quantity: netQuantity,
          sales: netSales,
        });
      }
    });

    return Array.from(productMap.values())
      .filter((product) => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders, items, returns]);

  // ON-HAND STOCK ANALYTICS

  const stockAnalytics = useMemo(() => {
    return {
      totalItems: stocks.length,

      totalOnHand: stocks.reduce(
        (sum, stock) =>
          sum + numberValue(stock.quantity_on_hand),
        0
      ),

      totalReserved: stocks.reduce(
        (sum, stock) =>
          sum + numberValue(stock.quantity_reserved),
        0
      ),

      totalAvailable: stocks.reduce(
        (sum, stock) =>
          sum + numberValue(stock.available_stock),
        0
      ),

      lowStock: stocks.filter(
        (stock) => stock.status === "Low Stock"
      ).length,

      outOfStock: stocks.filter(
        (stock) => stock.status === "Out of Stock"
      ).length,
    };
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    const search = stockSearch.trim().toLowerCase();

    if (!search) return stocks;

    return stocks.filter(
      (stock) =>
        stock.Item_Name.toLowerCase().includes(search) ||
        stock.SKU.toLowerCase().includes(search) ||
        String(stock.IM_ID).includes(search)
    );
  }, [stocks, stockSearch]);

  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        const dateA = Date.parse(a.invoice_date ?? "");
        const dateB = Date.parse(b.invoice_date ?? "");

        return (
          (Number.isFinite(dateB) ? dateB : 0) -
          (Number.isFinite(dateA) ? dateA : 0)
        );
      })
      .slice(0, 5);
  }, [invoices]);

  const chartWidth = 560;
  const chartHeight = 160;

  const chartPadding = {
    top: 10,
    right: 16,
    bottom: 28,
    left: 64,
  };

  const maxMonthlyValue = Math.max(
    1,
    ...monthlyAnalytics.flatMap((month) => [
      month.sales,
      month.collections,
    ])
  );

  const chartX = (index: number) =>
    chartPadding.left +
    (index *
      (chartWidth - chartPadding.left - chartPadding.right)) /
      Math.max(monthlyAnalytics.length - 1, 1);

  const chartY = (value: number) =>
    chartHeight -
    chartPadding.bottom -
    (value / maxMonthlyValue) *
      (chartHeight - chartPadding.top - chartPadding.bottom);

  const salesLine = monthlyAnalytics
    .map((month, index) =>
      `${chartX(index)},${chartY(month.sales)}`
    )
    .join(" ");

  const collectionsLine = monthlyAnalytics
    .map(
      (month, index) =>
        `${chartX(index)},${chartY(month.collections)}`
    )
    .join(" ");

  const chartAxisLabels = [0, 0.25, 0.5, 0.75, 1];

  const getStockStatusStyle = (status: string) => {
    switch (status) {
      case "In Stock":
        return "bg-emerald-100 text-emerald-700";

      case "Low Stock":
        return "bg-amber-100 text-amber-700";

      case "Out of Stock":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="min-h-full w-full min-w-0 space-y-5 bg-white p-3 text-slate-900 sm:space-y-6 sm:p-5 lg:p-6">

      {/* PAGE HEADER */}

      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {PAGE_TITLE}
        </h1>

        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          Overview of sales performance and financial activities.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">
            Unable to load dashboard data
          </p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      {/* SALES SUMMARY CARDS */}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">

        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-600 sm:text-sm">
            Total Sales
          </p>

          <p className="mt-2 break-words text-xl font-bold text-slate-900 sm:text-2xl">
            {loading ? "—" : money(analytics.totalSales)}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Based on sales invoices
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-600 sm:text-sm">
            Total Orders
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            {loading ? "—" : analytics.totalOrders.toLocaleString()}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            {loading ? "—" : analytics.activeOrders} non-cancelled orders
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-600 sm:text-sm">
            Outstanding Balance
          </p>

          <p className="mt-2 break-words text-xl font-bold text-amber-600 sm:text-2xl">
            {loading ? "—" : money(analytics.outstandingBalance)}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Remaining accounts receivable
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-600 sm:text-sm">
            Total Collections
          </p>

          <p className="mt-2 break-words text-xl font-bold text-emerald-600 sm:text-2xl">
            {loading ? "—" : money(analytics.totalCollections)}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Recorded customer payments
          </p>
        </div>

      </div>

      {/* SALES PERFORMANCE AND TOP PRODUCTS */}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 2xl:grid-cols-2">

        {/* SALES PERFORMANCE */}

        <section className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-3 shadow-sm sm:p-4">

          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Sales Performance
            </h2>

            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Monthly sales and collections for the last six months.
            </p>
          </div>

          {loading || !currentDate ? (
            <p className="py-8 text-center text-sm text-slate-600">
              Loading sales performance...
            </p>
          ) : monthlyAnalytics.every(
              (month) =>
                month.sales === 0 &&
                month.collections === 0
            ) ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No sales or collection records available for this period.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-4 text-xs">

                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Sales
                </span>

                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Collections
                </span>

              </div>

              <div className="w-full min-w-0 overflow-x-auto">
                <div className="mx-auto min-w-[340px] max-w-[560px]">

                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="h-auto w-full"
                    role="img"
                    aria-label="Monthly sales and collections line graph"
                  >

                    {chartAxisLabels.map((ratio) => {
                      const value = maxMonthlyValue * ratio;
                      const y = chartY(value);

                      return (
                        <g key={ratio}>

                          <line
                            x1={chartPadding.left}
                            y1={y}
                            x2={chartWidth - chartPadding.right}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeDasharray="4 4"
                          />

                          <text
                            x={chartPadding.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#475569"
                          >
                            {value >= 1000
                              ? `₱${(value / 1000).toFixed(0)}k`
                              : `₱${value.toFixed(0)}`}
                          </text>

                        </g>
                      );
                    })}

                    <polyline
                      points={salesLine}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <polyline
                      points={collectionsLine}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {monthlyAnalytics.map((month, index) => (
                      <g key={month.key}>

                        <circle
                          cx={chartX(index)}
                          cy={chartY(month.sales)}
                          r="4"
                          fill="#2563eb"
                          stroke="white"
                          strokeWidth="1.5"
                        >
                          <title>
                            {month.label} Sales: {money(month.sales)}
                          </title>
                        </circle>

                        <circle
                          cx={chartX(index)}
                          cy={chartY(month.collections)}
                          r="4"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="1.5"
                        >
                          <title>
                            {month.label} Collections: {money(month.collections)}
                          </title>
                        </circle>

                        <text
                          x={chartX(index)}
                          y={chartHeight - 12}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#475569"
                        >
                          {month.label}
                        </text>

                      </g>
                    ))}

                  </svg>

                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#D1D5DB] pt-3 sm:grid-cols-2">

                <div className="min-w-0">
                  <p className="text-xs text-slate-600">
                    Sales in displayed period
                  </p>

                  <p className="mt-1 break-words font-semibold text-blue-700">
                    {money(
                      monthlyAnalytics.reduce(
                        (sum, month) => sum + month.sales,
                        0
                      )
                    )}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-600">
                    Collections in displayed period
                  </p>

                  <p className="mt-1 break-words font-semibold text-emerald-700">
                    {money(
                      monthlyAnalytics.reduce(
                        (sum, month) => sum + month.collections,
                        0
                      )
                    )}
                  </p>
                </div>

              </div>
            </>
          )}

        </section>

        {/* TOP SELLING PRODUCTS */}

        <section className={cardClass}>

          <div className="mb-4 sm:mb-5">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Top Selling Products
            </h2>

            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Products ranked by net quantity sold, after recorded returns.
            </p>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-600">
              Loading product analytics...
            </p>
          ) : topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No product sales records available yet.
            </p>
          ) : (
            <div className="-mx-1 overflow-x-auto">

              <table className="w-full min-w-[480px] text-left text-sm">

                <thead>
                  <tr className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-[10px] uppercase tracking-wide text-slate-700 sm:text-xs">
                    <th className="px-3 py-3 sm:px-4">Rank</th>
                    <th className="px-3 py-3 sm:px-4">Product</th>
                    <th className="px-3 py-3 text-center sm:px-4">
                      Quantity Sold
                    </th>
                    <th className="px-3 py-3 text-center sm:px-4">
                      Net Sales
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {topProducts.map((product, index) => (
                    <tr
                      key={product.IM_ID}
                      className="border-b border-[#D1D5DB] last:border-0 hover:bg-[#DDE1E5]"
                    >
                      <td className="px-3 py-3 font-semibold text-slate-600 sm:px-4 sm:py-4">
                        #{index + 1}
                      </td>

                      <td className="max-w-[180px] break-words px-3 py-3 font-semibold text-slate-800 sm:px-4 sm:py-4">
                        {product.name}
                      </td>

                      <td className="px-3 py-3 text-center font-semibold text-slate-800 sm:px-4 sm:py-4">
                        {product.quantity.toLocaleString()}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center font-semibold text-slate-800 sm:px-4 sm:py-4">
                        {money(product.sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>

      {/* ON-HAND STOCKS */}

      <section className={cardClass}>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              On-Hand Stocks
            </h2>

            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Current inventory availability across all warehouses.
            </p>
          </div>

        </div>

        {/* STOCK SUMMARY */}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">

          <div className="rounded-lg border border-[#D1D5DB] bg-white p-3">
            <p className="text-xs text-slate-600">
              Total Items
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {stockLoading ? "—" : stockAnalytics.totalItems.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg border border-[#D1D5DB] bg-white p-3">
            <p className="text-xs text-slate-600">
              Available Units
            </p>

            <p className="mt-1 text-xl font-bold text-emerald-700">
              {stockLoading ? "—" : stockAnalytics.totalAvailable.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg border border-[#D1D5DB] bg-white p-3">
            <p className="text-xs text-slate-600">
              Low Stock Items
            </p>

            <p className="mt-1 text-xl font-bold text-amber-600">
              {stockLoading ? "—" : stockAnalytics.lowStock.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg border border-[#D1D5DB] bg-white p-3">
            <p className="text-xs text-slate-600">
              Out of Stock
            </p>

            <p className="mt-1 text-xl font-bold text-red-600">
              {stockLoading ? "—" : stockAnalytics.outOfStock.toLocaleString()}
            </p>
          </div>

        </div>

        {/* SEARCH */}

        <div className="mt-4">
          <input
            type="search"
            value={stockSearch}
            onChange={(event) => setStockSearch(event.target.value)}
            placeholder="Search product name or SKU..."
            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-sm"
          />
        </div>

        {/* STOCK ERRORS */}

        {stockError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">
              Unable to load on-hand stocks
            </p>

            <p className="mt-1 break-words">
              {stockError}
            </p>
          </div>
        )}

        {/* STOCK TABLE */}

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#D1D5DB]">

          <table className="w-full min-w-[760px] text-left text-sm">

            <thead>
              <tr className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-[10px] uppercase tracking-wide text-slate-700 sm:text-xs">

                <th className="px-3 py-3 sm:px-4">
                  Product
                </th>

                <th className="px-3 py-3 sm:px-4">
                  SKU
                </th>

                <th className="px-3 py-3 text-center sm:px-4">
                  On Hand
                </th>

                <th className="px-3 py-3 text-center sm:px-4">
                  Reserved
                </th>

                <th className="px-3 py-3 text-center sm:px-4">
                  Available
                </th>

                <th className="px-3 py-3 text-center sm:px-4">
                  Reorder Level
                </th>

                <th className="px-3 py-3 text-center sm:px-4">
                  Status
                </th>

              </tr>
            </thead>

            <tbody>

              {stockLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-600"
                  >
                    Loading inventory stocks...
                  </td>
                </tr>
              ) : stockError ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-600"
                  >
                    Inventory information is currently unavailable.
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-600"
                  >
                    {stockSearch
                      ? "No matching products found."
                      : "No inventory records available."}
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr
                    key={stock.IM_ID}
                    className="border-b border-[#D1D5DB] last:border-0 hover:bg-[#DDE1E5]"
                  >

                    <td className="max-w-[200px] break-words px-3 py-3 font-semibold text-slate-800 sm:px-4">
                      {stock.Item_Name}

                      {stock.unit_of_measure && (
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          ({stock.unit_of_measure})
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-slate-600 sm:px-4">
                      {stock.SKU}
                    </td>

                    <td className="px-3 py-3 text-center font-medium text-slate-800 sm:px-4">
                      {numberValue(stock.quantity_on_hand).toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-600 sm:px-4">
                      {numberValue(stock.quantity_reserved).toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-center font-bold text-slate-900 sm:px-4">
                      {numberValue(stock.available_stock).toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-600 sm:px-4">
                      {numberValue(stock.reorder_level).toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-center sm:px-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStockStatusStyle(stock.status)}`}
                      >
                        {stock.status}
                      </span>
                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">

          <span>
            Showing {stockLoading ? 0 : filteredStocks.length} of{" "}
            {stockLoading ? 0 : stocks.length} products
          </span>

          <span>
            Available = On Hand − Reserved
          </span>

        </div>

      </section>

    </div>
  );
}
