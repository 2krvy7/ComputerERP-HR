
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  paymentCollectionAPI,
  salesOrderAPI,
  invoiceAPI,
  accountsReceivableAPI,
  salesReturnAPI,
} from "../lib/api";

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

const numberValue = (value: string | number | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const datePart = value.split("T")[0];
  const date = new Date(`${datePart}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  "rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm";

export default function DashboardPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);

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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const analytics = useMemo(() => {
    const totalSales = invoices.reduce(
      (sum, invoice) => sum + numberValue(invoice.total_due),
      0
    );

    const totalCollections = collections.reduce(
      (sum, collection) => sum + numberValue(collection.amount_paid),
      0
    );

    const outstandingBalance = receivables.reduce(
      (sum, record) => sum + numberValue(record.balance),
      0
    );

    const totalReturns = returns.reduce(
      (sum, record) => sum + numberValue(record.return_amount),
      0
    );

    const activeOrders = orders.filter(
      (order) => order.status !== "Cancelled"
    );

    const orderStatuses = [
      "Pending",
      "Approved",
      "Processing",
      "Completed",
      "Cancelled",
    ].map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    }));

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
          (sum, invoice) => sum + numberValue(invoice.total_due),
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
      const returnedQty = returnedQuantities.get(detailId) ?? 0;
      const returnedAmount = returnedAmounts.get(detailId) ?? 0;

      const netQuantity = Math.max(0, detail.quantity - returnedQty);
      const netSales = Math.max(0, detail.lineTotal - returnedAmount);

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
    .map((month, index) => `${chartX(index)},${chartY(month.sales)}`)
    .join(" ");

  const collectionsLine = monthlyAnalytics
    .map(
      (month, index) =>
        `${chartX(index)},${chartY(month.collections)}`
    )
    .join(" ");

  const chartAxisLabels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="min-h-full space-y-6 bg-green-50 p-4 text-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Overview of sales performance and financial activities.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Unable to load dashboard data</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClass}>
          <p className="text-sm font-medium text-slate-600">
            Total Sales
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? "—" : money(analytics.totalSales)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Based on sales invoices
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-slate-600">
            Total Orders
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? "—" : analytics.totalOrders.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {loading ? "—" : analytics.activeOrders} non-cancelled orders
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-slate-600">
            Outstanding Balance
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {loading ? "—" : money(analytics.outstandingBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Remaining accounts receivable
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-slate-600">
            Total Collections
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? "—" : money(analytics.totalCollections)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Recorded customer payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <section className="w-full rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">
              Sales Performance
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Monthly sales and collections for the last six months.
            </p>
          </div>

          {loading || !currentDate ? (
            <p className="py-8 text-center text-sm text-slate-600">
              Loading sales performance...
            </p>
          ) : monthlyAnalytics.every(
              (month) => month.sales === 0 && month.collections === 0
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

              <div className="mx-auto w-full max-w-[560px]">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="mx-auto h-auto w-full"
                  role="img"
                  aria-label="Line graph showing monthly sales and collections for the last six months"
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

              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#D1D5DB] pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-600">
                    Sales in displayed period
                  </p>
                  <p className="mt-1 font-semibold text-blue-700">
                    {money(
                      monthlyAnalytics.reduce(
                        (sum, month) => sum + month.sales,
                        0
                      )
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    Collections in displayed period
                  </p>
                  <p className="mt-1 font-semibold text-emerald-700">
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

        <section className={cardClass}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Top Selling Products
            </h2>
            <p className="mt-1 text-sm text-slate-600">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center">
                      Quantity Sold
                    </th>
                    <th className="px-4 py-3 text-center">
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
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        #{index + 1}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {product.name}
                      </td>

                      <td className="px-4 py-4 text-center font-semibold text-slate-800">
                        {product.quantity.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-center font-semibold text-slate-800">
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
    </div>
  );
}
