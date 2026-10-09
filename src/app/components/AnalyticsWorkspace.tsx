"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChartPie, TrendingUp } from "lucide-react";

import type { TransactionReportRow } from "@/lib/finance/transaction-report";
import {
  expenseScopeLabels,
  expenseScopes,
  type ExpenseScopeFilter,
} from "@/lib/finance/expense-scope";
import { monthLabel } from "@/lib/finance/month";

type Metric = "expense" | "income" | "balance";
type Period = "month" | "six_months" | "year";

const colors = [
  "#B8976C",
  "#D4C3A3",
  "#8C827A",
  "#A3835B",
  "#C7AA80",
  "#6B573F",
  "#DED2BD",
  "#B9A58A",
];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function metricAmount(rows: TransactionReportRow[], metric: Metric) {
  return rows.reduce((sum, row) => {
    if (metric === "balance") return sum + (row.kind === "income" ? row.amount : -row.amount);
    return row.kind === metric ? sum + row.amount : sum;
  }, 0);
}

export function AnalyticsWorkspace({
  transactions,
  currency,
  selectedMonth,
}: {
  transactions: TransactionReportRow[];
  currency: string;
  selectedMonth: string;
}) {
  const [metric, setMetric] = useState<Metric>("expense");
  const [period, setPeriod] = useState<Period>("month");
  const [scopeFilter, setScopeFilter] = useState<ExpenseScopeFilter>("all");
  const currentMonth = selectedMonth;
  const previousMonth = shiftMonth(currentMonth, -1);
  const firstMonth =
    period === "year"
      ? `${currentMonth.slice(0, 4)}-01`
      : period === "six_months"
        ? shiftMonth(currentMonth, -5)
        : currentMonth;
  const currencyTransactions = transactions.filter(
    (row) =>
      row.currency === currency &&
      (row.kind !== "expense" || scopeFilter === "all" || row.scope === scopeFilter),
  );
  const currentRows = currencyTransactions.filter(
    (row) => row.date.slice(0, 7) >= firstMonth && row.date.slice(0, 7) <= currentMonth,
  );
  const thisMonthRows = currencyTransactions.filter(
    (row) => row.date.slice(0, 7) === currentMonth,
  );
  const lastMonthRows = currencyTransactions.filter(
    (row) => row.date.slice(0, 7) === previousMonth,
  );
  const thisMonthAmount = metricAmount(thisMonthRows, metric);
  const lastMonthAmount = metricAmount(lastMonthRows, metric);
  const monthChange = thisMonthAmount - lastMonthAmount;

  const categories = (() => {
    const values = new Map<string, { amount: number; categoryId: string | null }>();
    for (const row of currentRows) {
      if (metric !== "balance" && row.kind !== metric) continue;
      const key = row.category || "未分類";
      const bucket = values.get(key) ?? { amount: 0, categoryId: row.categoryId };
      bucket.amount += metric === "balance" && row.kind === "expense" ? -row.amount : row.amount;
      values.set(key, bucket);
    }
    return [...values.entries()]
      .map(([name, item]) => ({ name, ...item }))
      .filter((item) => item.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  })();

  const categoryTotal = categories.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const slices = categories.slice(0, 8);
  const otherAmount = categories.slice(8).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  if (otherAmount > 0) slices.push({ name: "其他", amount: otherAmount, categoryId: null });
  const sliceTotal = slices.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const gradientParts = slices.map((slice, index) => {
    const start =
      slices
        .slice(0, index)
        .reduce((sum, item) => sum + (Math.abs(item.amount) / sliceTotal) * 100, 0);
    const end = start + (Math.abs(slice.amount) / sliceTotal) * 100;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  const monthlyKeys =
    period === "month"
      ? [previousMonth, currentMonth]
      : Array.from({ length: period === "year" ? 12 : 6 }, (_, index) =>
          shiftMonth(firstMonth, index),
        ).filter((month) => month <= currentMonth);
  const monthlyTotals = monthlyKeys.map((month) => {
    const monthRows = currencyTransactions.filter((row) => row.date.slice(0, 7) === month);
    return {
      month,
      income: metricAmount(monthRows, "income"),
      expense: metricAmount(monthRows, "expense"),
    };
  });
  const maxMonthlyMagnitude = Math.max(
    1,
    ...monthlyTotals.flatMap((item) => [item.income, item.expense]),
  );
  const monthlyIncomeChange =
    metricAmount(thisMonthRows, "income") - metricAmount(lastMonthRows, "income");
  const monthlyExpenseChange =
    metricAmount(thisMonthRows, "expense") - metricAmount(lastMonthRows, "expense");

  const metricLabels: Record<Metric, string> = {
    expense: "支出",
    income: "收入",
    balance: "結餘",
  };
  const periodLabels: Record<Period, string> = {
    month: "本月",
    six_months: "近 6 個月",
    year: "今年",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#8C827A]">家庭帳本</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">分析統計</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["expense", "income", "balance"] as const).map((option) => (
            <button
              aria-pressed={metric === option}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                metric === option
                  ? "bg-[#B8976C] text-white"
                  : "border border-[#EFECE6] bg-white text-[#8C827A]"
              }`}
              key={option}
              onClick={() => setMetric(option)}
              type="button"
            >
              {metricLabels[option]}
            </button>
          ))}
        </div>
      </div>

      <div aria-label="統計期間" className="flex gap-2" role="group">
        {(["month", "six_months", "year"] as const).map((option) => (
          <button
            aria-pressed={period === option}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              period === option
                ? "bg-[#B8976C] text-white"
                : "text-[#8C827A] hover:bg-white"
            }`}
            key={option}
            onClick={() => setPeriod(option)}
            type="button"
          >
            {periodLabels[option]}
          </button>
        ))}
      </div>

      <div
        aria-label="支出對象篩選"
        className="flex w-full gap-1 overflow-x-auto rounded-lg bg-[#E8DEC9] p-1 sm:w-fit"
        role="group"
      >
        {(["all", ...expenseScopes] as const).map((option) => {
          const label =
            option === "all"
              ? "全部支出"
              : option === "personal"
                ? "個人真實純支出"
                : expenseScopeLabels[option];
          return (
            <button
              aria-pressed={scopeFilter === option}
              className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium transition ${
                scopeFilter === option
                  ? "bg-[#B8976C] text-white shadow-sm"
                  : "text-[#8C827A] hover:text-[#2C2623]"
              }`}
              key={option}
              onClick={() => setScopeFilter(option)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="-mt-4 text-xs text-[#8C827A]">此篩選套用於支出；收入金額不受影響。</p>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="border-l-2 border-[#D4C3A3] bg-white px-5 py-5">
          <p className="text-sm text-[#8C827A]">{monthLabel(currentMonth)}{metricLabels[metric]}</p>
          <p className="mt-3 text-2xl font-semibold text-[#2C2623]">
            {formatMoney(thisMonthAmount, currency)}
          </p>
          <p className="mt-2 flex items-center gap-1 text-xs text-[#8C827A]">
            {monthChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            與{monthLabel(previousMonth)}相比 {monthChange >= 0 ? "增加" : "減少"}{" "}
            {formatMoney(Math.abs(monthChange), currency)}
          </p>
        </article>
        <article className="border-l-2 border-[#D4C3A3] bg-white px-5 py-5">
          <p className="text-sm text-[#8C827A]">{periodLabels[period]}{metricLabels[metric]}</p>
          <p className="mt-3 text-2xl font-semibold text-[#2C2623]">
            {formatMoney(metricAmount(currentRows, metric), currency)}
          </p>
          <p className="mt-2 text-xs text-[#8C827A]">
            依交易分類彙整 · 僅計 {currency}
          </p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-y border-[#EFECE6] bg-white px-5 py-6 sm:px-7">
          <div className="flex items-center gap-2">
            <ChartPie className="text-[#6B573F]" size={19} />
            <div>
              <h2 className="font-semibold">分類金額占比</h2>
              <p className="mt-1 text-xs text-[#8C827A]">
                {periodLabels[period]}{metricLabels[metric]} · 百分比
              </p>
            </div>
          </div>
          {slices.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(9rem,0.9fr)_1.1fr] sm:items-center">
              <div
                aria-label="分類占比圓餅圖"
                className="mx-auto aspect-square w-full max-w-52 rounded-full"
                role="img"
                style={{
                  background:
                    gradientParts.length > 0
                      ? `conic-gradient(${gradientParts.join(", ")})`
                      : "#E8DEC9",
                }}
              />
              <ul className="space-y-3">
                {slices.map((item, index) => (
                  <li className="flex items-center justify-between gap-3 text-sm" key={item.name}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="truncate text-[#8C827A]">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-right font-medium text-[#2C2623]">
                      {categoryTotal
                        ? `${((Math.abs(item.amount) / categoryTotal) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-[#EFECE6] px-4 py-8 text-center text-sm text-[#8C827A]">
              此期間尚無分類交易。
            </p>
          )}
        </section>

        <section className="border-y border-[#EFECE6] bg-white px-5 py-6 sm:px-7">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-[#6B573F]" size={19} />
            <div>
              <h2 className="font-semibold">月度收支比較</h2>
              <p className="mt-1 text-xs text-[#8C827A]">
                各月收入與支出金額，和上月增減見下方
              </p>
            </div>
          </div>
          <div className="mt-6 flex h-56 items-end gap-2 border-b border-[#EFECE6] pb-2 sm:gap-3">
            {monthlyTotals.map((item) => {
              return (
                <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" key={item.month}>
                  <div className="flex h-44 w-full items-end justify-center gap-1">
                    {[
                      { kind: "收入", amount: item.income, color: "bg-[#B8976C]" },
                      { kind: "支出", amount: item.expense, color: "bg-[#D4C3A3]" },
                    ].map((bar) => (
                      <div
                        aria-label={`${item.month} ${bar.kind} ${formatMoney(bar.amount, currency)}`}
                        className={`w-2/5 max-w-5 rounded-t-md ${bar.color}`}
                        key={bar.kind}
                        role="img"
                        style={{
                          height: `${Math.max(2, (bar.amount / maxMonthlyMagnitude) * 100)}%`,
                        }}
                        title={`${bar.kind} ${formatMoney(bar.amount, currency)}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#8C827A]">{item.month.slice(5)}月</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#8C827A]">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-[#B8976C]" />
              收入
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-[#D4C3A3]" />
              支出
            </span>
          </div>
          <div className="mt-4 grid gap-2 border-t border-[#EFECE6] pt-3 text-xs sm:grid-cols-2">
            <p className="text-[#8C827A]">
              收入較上月 {monthlyIncomeChange >= 0 ? "增加" : "減少"}{" "}
              <span className="font-medium text-[#2C2623]">
                {formatMoney(Math.abs(monthlyIncomeChange), currency)}
              </span>
            </p>
            <p className="text-[#8C827A]">
              支出較上月 {monthlyExpenseChange >= 0 ? "增加" : "減少"}{" "}
              <span className="font-medium text-[#2C2623]">
                {formatMoney(Math.abs(monthlyExpenseChange), currency)}
              </span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#8C827A]">
            <span>{monthlyTotals[0]?.month ?? ""}</span>
            <span>{monthlyTotals.at(-1)?.month ?? ""}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
