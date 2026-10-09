"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  Bus,
  ChartPie,
  Droplets,
  Flame,
  Gift,
  HeartPulse,
  House,
  Package,
  ShoppingBasket,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";

import type { TransactionReportRow } from "@/lib/finance/transaction-report";
import {
  expenseScopeLabels,
  expenseScopes,
  type ExpenseScopeFilter,
} from "@/lib/finance/expense-scope";
import { monthLabel } from "@/lib/finance/month";
import { ExcelExportButton } from "@/app/components/ExcelExportButton";

type Metric = "expense" | "income" | "balance";
type Period = "month" | "six_months" | "year";
type ViewMode = "personal" | "family";
type CategorySummary = {
  key: string;
  name: string;
  categoryId: string | null;
  icon: string | null;
  color: string;
  amount: number;
  percentage: number;
  transactions: TransactionReportRow[];
};

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

const categoryIcons: Record<string, LucideIcon> = {
  bus: Bus,
  health: HeartPulse,
  house: House,
  shopping: ShoppingBasket,
  utensils: Utensils,
  wallet: Wallet,
};

function getCategoryIcon(icon: string | null, name: string): LucideIcon {
  if (icon && categoryIcons[icon]) return categoryIcons[icon];
  if (/中獎|發票/.test(name)) return Target;
  if (/紅包|禮金/.test(name)) return Gift;
  if (/二手售出/.test(name)) return Package;
  if (/其他收入/.test(name)) return BadgeDollarSign;
  if (/水費/.test(name)) return Droplets;
  if (/電費/.test(name)) return Zap;
  if (/天然氣/.test(name)) return Flame;
  if (/管理費/.test(name)) return Building2;
  if (/餐|飲食|咖啡/.test(name)) return Utensils;
  if (/交通|通勤/.test(name)) return Bus;
  if (/醫療|保險|健康/.test(name)) return HeartPulse;
  if (/居家|房租|住房/.test(name)) return House;
  if (/日用|購物|生活/.test(name)) return ShoppingBasket;
  return Wallet;
}

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
  userId,
}: {
  transactions: TransactionReportRow[];
  currency: string;
  selectedMonth: string;
  userId: string;
}) {
  const [metric, setMetric] = useState<Metric>("expense");
  const [period, setPeriod] = useState<Period>("month");
  const [scopeFilter, setScopeFilter] = useState<ExpenseScopeFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
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
      (viewMode === "family" || row.isJoint || row.ownerId === userId) &&
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

  const expenseRows = currentRows.filter((row) => row.kind === "expense");
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const categories: CategorySummary[] = (() => {
    const values = new Map<string, CategorySummary>();
    for (const row of expenseRows) {
      const name = row.category || "未分類";
      const key = `${row.categoryId ?? ""}:${name}`;
      const bucket = values.get(key) ?? {
        key,
        name,
        categoryId: row.categoryId,
        icon: row.categoryIcon,
        color: row.categoryColor || colors[values.size % colors.length],
        amount: 0,
        percentage: 0,
        transactions: [],
      };
      bucket.amount += row.amount;
      bucket.transactions.push(row);
      values.set(key, bucket);
    }
    return [...values.values()]
      .map((item) => ({
        ...item,
        percentage: expenseTotal ? item.amount / expenseTotal : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  })();
  const gradientParts: string[] = [];
  let gradientPosition = 0;
  for (const category of categories) {
    const nextPosition = gradientPosition + category.percentage * 100;
    gradientParts.push(`${category.color} ${gradientPosition}% ${nextPosition}%`);
    gradientPosition = nextPosition;
  }
  const selectedCategory =
    categories.find((category) => category.key === selectedCategoryKey) ?? null;
  const SelectedCategoryIcon = selectedCategory
    ? getCategoryIcon(selectedCategory.icon, selectedCategory.name)
    : null;
  const selectedCategoryRows = selectedCategory
    ? [...selectedCategory.transactions].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const groupedCategoryRows = selectedCategoryRows.reduce<
    { date: string; rows: TransactionReportRow[] }[]
  >((groups, row) => {
    const lastGroup = groups.at(-1);
    if (lastGroup?.date === row.date) lastGroup.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
    return groups;
  }, []);
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
  const viewLabels: Record<ViewMode, string> = {
    personal: "個人",
    family: "家庭",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#8C827A]">家庭帳本</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">分析統計</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton
            expenseScope={scopeFilter}
            month={selectedMonth}
            ownerId={viewMode === "personal" ? userId : null}
            period={period}
          />
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

      <div aria-label="個人或家庭統計" className="flex w-fit gap-1 rounded-full bg-[#E8DEC9] p-1" role="group">
        {(["personal", "family"] as const).map((option) => (
          <button
            aria-pressed={viewMode === option}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              viewMode === option
                ? "bg-[#B8976C] text-white shadow-sm"
                : "text-[#6B573F] hover:bg-white/60"
            }`}
            key={option}
            onClick={() => setViewMode(option)}
            type="button"
          >
            {viewLabels[option]}
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
              <h2 className="font-semibold">支出分類</h2>
              <p className="mt-1 text-xs text-[#8C827A]">
                {viewLabels[viewMode]} · {periodLabels[period]} · {scopeFilter === "all" ? "全部支出" : expenseScopeLabels[scopeFilter]}
              </p>
            </div>
          </div>
          {categories.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(12rem,0.85fr)_1.15fr] sm:items-center">
              <div className="relative mx-auto aspect-square w-full max-w-56">
                <div
                  aria-label={`分類支出圓環圖，總支出 ${formatMoney(expenseTotal, currency)}`}
                  className="absolute inset-0 rounded-full"
                  role="img"
                  style={{ background: `conic-gradient(${gradientParts.join(", ")})` }}
                />
                <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white text-center">
                  <span className="text-xs text-[#8C827A]">總支出</span>
                  <span className="mt-1 text-lg font-semibold tabular-nums text-[#2C2623]">
                    {formatMoney(expenseTotal, currency)}
                  </span>
                </div>
              </div>
              <ul aria-label="支出分類明細" className="space-y-2">
                {categories.map((item) => {
                  const CategoryIcon = getCategoryIcon(item.icon, item.name);
                  return (
                    <li key={item.key}>
                      <button
                        className="flex w-full items-center gap-3 rounded-xl border border-[#EFECE6] bg-white px-3 py-3 text-left transition hover:border-[#D4C3A3] hover:bg-[#FBF9F5]"
                        onClick={() => setSelectedCategoryKey(item.key)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-full"
                          style={{ backgroundColor: `${item.color}22` }}
                        >
                          <CategoryIcon aria-hidden="true" color={item.color} size={19} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[#2C2623]">{item.name}</span>
                          <span className="mt-0.5 block text-xs tabular-nums text-[#8C827A]">
                            {(item.percentage * 100).toFixed(1)}% · {item.transactions.length} 筆
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-[#2C2623]">
                          {formatMoney(item.amount, currency)}
                        </span>
                      </button>
                    </li>
                  );
                })}
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

            {selectedCategory && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2623]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setSelectedCategoryKey(null);
                }}
              >
                <section
                  aria-labelledby="category-detail-title"
                  aria-modal="true"
                  className="max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-[#FBF9F5] shadow-2xl sm:rounded-3xl"
                  role="dialog"
                >
                  <header
                    className="flex items-center gap-3 border-b border-[#EFECE6] px-5 py-4"
                    style={{ borderTop: `4px solid ${selectedCategory.color}` }}
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-white">
                      {SelectedCategoryIcon && (
                        <SelectedCategoryIcon
                          aria-hidden="true"
                          color={selectedCategory.color}
                          size={21}
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold" id="category-detail-title">
                        {selectedCategory.name}
                      </h2>
                      <p className="text-xs text-[#8C827A]">
                        {selectedCategory.transactions.length} 筆 · {formatMoney(selectedCategory.amount, currency)}
                      </p>
                    </div>
                    <button
                      aria-label="關閉分類明細"
                      className="grid size-9 place-items-center rounded-full text-[#8C827A] hover:bg-white"
                      onClick={() => setSelectedCategoryKey(null)}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </header>
                  <div className="max-h-[calc(85dvh-5rem)] overflow-y-auto px-5 py-4">
                    {groupedCategoryRows.map((group) => (
                      <section className="mb-5 last:mb-0" key={group.date}>
                        <h3 className="mb-2 text-xs font-semibold text-[#8C827A]">{group.date}</h3>
                        <ul className="divide-y divide-[#EFECE6] rounded-xl bg-white px-3">
                          {group.rows.map((row, index) => (
                            <li className="flex items-center gap-3 py-3" key={`${row.date}-${row.description}-${index}`}>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[#2C2623]">
                                  {row.description || row.category}
                                </p>
                                {row.notes && <p className="mt-0.5 truncate text-xs text-[#8C827A]">{row.notes}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold tabular-nums text-[#2C2623]">
                                  {formatMoney(row.amount, currency)}
                                </p>
                                <p className="mt-0.5 text-[11px] tabular-nums text-[#8C827A]">
                                  {selectedCategory.amount
                                    ? `${((row.amount / selectedCategory.amount) * 100).toFixed(1)}%`
                                    : "0%"}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </section>
              </div>
            )}
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
