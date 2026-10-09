import ExcelJS from "exceljs";

import { getFinanceContext } from "@/lib/finance/context";
import { loadTransactionReportRows, type TransactionReportRow } from "@/lib/finance/transaction-report";
import { loadDashboardData } from "@/lib/finance/dashboard";
import { monthDateRange, normalizeMonthKey, shiftMonthKey } from "@/lib/finance/month";
import {
  expenseScopeLabels,
  expenseScopes,
  type ExpenseScopeFilter,
} from "@/lib/finance/expense-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportSummary = {
  bank: number;
  investments: number;
  otherAssets: number;
  liabilities: number;
  netWorth: number;
};

type MonthlyTotal = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
};

type CategoryTotal = {
  category: string;
  amount: number;
  percentage: number;
  transactions: number;
};

type AnalyticsData = {
  month: string;
  period: "month" | "six_months" | "year";
  filter: string;
  monthlyTotals: MonthlyTotal[];
  categories: CategoryTotal[];
  transactions: TransactionReportRow[];
  totalExpenses: number;
};

const currencyFormat = '#,##0.00;[Red](#,##0.00);-';

function formatScope(scope: TransactionReportRow["scope"]) {
  if (scope === "family") return "家庭";
  return expenseScopeLabels[scope] ?? "個人";
}

function formatPeriod(period: AnalyticsData["period"]) {
  if (period === "year") return "今年";
  if (period === "six_months") return "近 6 個月";
  return "本月";
}

function rowsForAnalytics(
  reportRows: TransactionReportRow[],
  currency: string,
  month: string,
  scope: ExpenseScopeFilter,
  period: AnalyticsData["period"],
) {
  const startMonth = shiftMonthKey(month, -11);
  const scopedRows = reportRows.filter(
    (row) =>
      row.currency === currency &&
      row.date.slice(0, 7) >= startMonth &&
      row.date.slice(0, 7) <= month &&
      (row.kind !== "expense" || scope === "all" || row.scope === scope),
  );

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const monthKey = shiftMonthKey(startMonth, index);
    const rows = scopedRows.filter((row) => row.date.slice(0, 7) === monthKey);
    const income = rows.reduce(
      (sum, row) => sum + (row.kind === "income" ? row.amount : 0),
      0,
    );
    const expenses = rows.reduce(
      (sum, row) => sum + (row.kind === "expense" ? row.amount : 0),
      0,
    );
    return { month: monthKey, income, expenses, balance: income - expenses };
  });

  const periodStart =
    period === "year"
      ? `${month.slice(0, 4)}-01`
      : period === "six_months"
        ? shiftMonthKey(month, -5)
        : month;
  const periodExpenses = scopedRows.filter(
    (row) =>
      row.kind === "expense" &&
      row.date.slice(0, 7) >= periodStart &&
      row.date.slice(0, 7) <= month,
  );
  const categoryBuckets = new Map<string, { amount: number; transactions: number }>();
  for (const row of periodExpenses) {
    const bucket = categoryBuckets.get(row.category) ?? { amount: 0, transactions: 0 };
    bucket.amount += row.amount;
    bucket.transactions += 1;
    categoryBuckets.set(row.category, bucket);
  }
  const totalExpenses = periodExpenses.reduce((sum, row) => sum + row.amount, 0);
  const categories = [...categoryBuckets.entries()]
    .map(([category, item]) => ({
      category,
      amount: item.amount,
      percentage: totalExpenses ? item.amount / totalExpenses : 0,
      transactions: item.transactions,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { scopedRows, monthlyTotals, categories, totalExpenses, periodExpenses };
}

function styleSectionHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB8976C" },
  };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function styleColumnHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6B573F" },
  };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  header.height = 24;
}

function csvCell(value: string | number) {
  const text = String(value);
  const safeText =
    typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function createCsv(summary: ExportSummary, currency: string, analytics: AnalyticsData) {
  const lines: (string | number)[][] = [
    ["資產負債表"],
    ["項目", "金額", "幣別"],
    ["銀行存款與現金", summary.bank, currency],
    ["投資部位", summary.investments, currency],
    ["其他資產（含房地產、車輛）", summary.otherAssets, currency],
    ["負債", -summary.liabilities, currency],
    ["淨資產總計", summary.netWorth, currency],
    [],
    ["支出分析統計"],
    ["分析月份", analytics.month],
    ["支出篩選", analytics.filter],
    ["分析期間", formatPeriod(analytics.period)],
    ["分析期間總支出", analytics.totalExpenses, currency],
    [],
    ["月度收支與結餘總覽"],
    ["月份", "收入", "支出", "結餘", "幣別"],
    ...analytics.monthlyTotals.map((item) => [
      item.month,
      item.income,
      item.expenses,
      item.balance,
      currency,
    ]),
    [],
    ["支出分類金額與百分比占比"],
    ["分類", "金額", "占比", "筆數", "幣別"],
    ...analytics.categories.map((item) => [
      item.category,
      item.amount,
      `${(item.percentage * 100).toFixed(1)}%`,
      item.transactions,
      currency,
    ]),
    [],
    ["分類交易明細"],
    ["日期", "類型", "費用歸屬", "分類", "金額", "幣別", "帳戶", "說明", "備註"],
    ...analytics.transactions.map((row) => [
      row.date,
      row.kind === "income" ? "收入" : "支出",
      row.kind === "expense" ? formatScope(row.scope) : "",
      row.category,
      row.kind === "expense" ? -row.amount : row.amount,
      row.currency,
      row.account,
      row.description,
      row.notes,
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

function createWorkbook(
  summary: ExportSummary,
  currency: string,
  analytics: AnalyticsData,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ledgero";
  workbook.created = new Date();

  const assetsSheet = workbook.addWorksheet("資產負債表");
  assetsSheet.columns = [
    { header: "項目", key: "item", width: 32 },
    { header: "金額", key: "amount", width: 22 },
    { header: "幣別", key: "currency", width: 12 },
  ];
  [
    ["銀行存款與現金", summary.bank],
    ["投資部位", summary.investments],
    ["其他資產（含房地產、車輛）", summary.otherAssets],
    ["負債", -summary.liabilities],
    ["淨資產總計", summary.netWorth],
  ].forEach(([item, amount]) => assetsSheet.addRow({ item, amount, currency }));
  assetsSheet.getColumn("amount").numFmt = currencyFormat;
  styleColumnHeader(assetsSheet);

  const analysisSheet = workbook.addWorksheet("支出分析統計");
  analysisSheet.columns = [
    { width: 34 },
    { width: 20 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 26 },
    { width: 32 },
    { width: 32 },
  ];
  analysisSheet.addRow(["支出分析統計"]);
  styleSectionHeader(analysisSheet.getRow(1));
  analysisSheet.addRow(["分析月份", analytics.month]);
  analysisSheet.addRow(["支出篩選", analytics.filter]);
  analysisSheet.addRow(["分析期間", formatPeriod(analytics.period)]);
  analysisSheet.addRow(["分析期間總支出", analytics.totalExpenses, currency]);
  analysisSheet.getCell("B5").numFmt = currencyFormat;
  analysisSheet.addRow([]);

  const monthlyHeading = analysisSheet.addRow(["月度收支與結餘總覽"]);
  styleSectionHeader(monthlyHeading);
  const monthlyHeader = analysisSheet.addRow(["月份", "收入", "支出", "結餘", "幣別"]);
  styleSectionHeader(monthlyHeader);
  analytics.monthlyTotals.forEach((item) =>
    analysisSheet.addRow([item.month, item.income, item.expenses, item.balance, currency]),
  );
  for (const column of ["B", "C", "D"]) {
    analysisSheet.getColumn(column).numFmt = currencyFormat;
  }

  analysisSheet.addRow([]);
  const categoryTitle = analysisSheet.addRow(["支出分類金額與百分比占比"]);
  styleSectionHeader(categoryTitle);
  const categoryHeader = analysisSheet.addRow(["分類", "金額", "占比", "筆數", "幣別"]);
  styleSectionHeader(categoryHeader);
  analytics.categories.forEach((item) =>
    analysisSheet.addRow([
      item.category,
      item.amount,
      item.percentage,
      item.transactions,
      currency,
    ]),
  );
  analysisSheet.getColumn("B").numFmt = currencyFormat;
  analysisSheet.getColumn("C").numFmt = "0.0%";

  analysisSheet.addRow([]);
  const detailsTitle = analysisSheet.addRow(["分析期間交易明細"]);
  styleSectionHeader(detailsTitle);
  const detailsHeader = analysisSheet.addRow([
    "日期",
    "類型",
    "費用歸屬",
    "分類",
    "金額",
    "幣別",
    "帳戶",
    "說明",
    "備註",
  ]);
  styleSectionHeader(detailsHeader);
  analytics.transactions.forEach((row) =>
    analysisSheet.addRow([
      row.date,
      row.kind === "income" ? "收入" : "支出",
      row.kind === "expense" ? formatScope(row.scope) : "",
      row.category,
      row.kind === "expense" ? -row.amount : row.amount,
      row.currency,
      row.account,
      row.description,
      row.notes,
    ]),
  );
  analysisSheet.getColumn("E").numFmt = currencyFormat;
  if (analytics.transactions.length) {
    analysisSheet.autoFilter = {
      from: `A${detailsHeader.number}`,
      to: `I${detailsHeader.number + analytics.transactions.length}`,
    };
  }
  return workbook;
}

export async function GET(request: Request) {
  const result = await getFinanceContext();
  if (!result.context) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  try {
    const { supabase, householdId, user } = result.context;
    const params = new URL(request.url).searchParams;
    const month = normalizeMonthKey(params.get("month") ?? undefined);
    const requestedScope = params.get("expenseScope") ?? "all";
    const ownerId = params.get("ownerId");
    const requestedPeriod = params.get("period");
    const period: AnalyticsData["period"] =
      requestedPeriod === "year" || requestedPeriod === "six_months"
        ? requestedPeriod
        : "month";
    const matchedScope = expenseScopes.find((scope) => scope === requestedScope);
    const expenseScope: ExpenseScopeFilter =
      requestedScope === "all" ? "all" : matchedScope ?? "all";
    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("base_currency")
      .eq("id", householdId)
      .single();
    if (householdError) {
      console.error("[finance export] household query failed", householdError);
      throw new Error(`Household query failed: ${householdError.message}`);
    }
    const currency = household.base_currency;
    const [dashboard, reportRows] = await Promise.all([
      loadDashboardData(supabase, householdId, user.id, currency, month),
      loadTransactionReportRows(
        supabase,
        householdId,
        monthDateRange(shiftMonthKey(month, -11)).start,
        monthDateRange(shiftMonthKey(month, 1)).start,
      ),
    ]);
    const summary = ownerId
      ? dashboard.memberTotals[ownerId]
      : dashboard.totals;
    if (ownerId && !summary) {
      return Response.json({ error: "無權匯出此成員的財務資料。" }, { status: 403 });
    }
    const scopedReportRows = ownerId
      ? reportRows.filter((row) => row.isJoint || row.ownerId === ownerId)
      : reportRows;
    const analyticsRows = rowsForAnalytics(
      scopedReportRows,
      currency,
      month,
      expenseScope,
      period,
    );
    const analytics: AnalyticsData = {
      month,
      period,
      filter: [
        ownerId ? "個人" : "家庭",
        expenseScope === "all" ? "全部支出" : expenseScopeLabels[expenseScope],
      ].join(" · "),
      monthlyTotals: analyticsRows.monthlyTotals,
      categories: analyticsRows.categories,
      transactions: analyticsRows.periodExpenses,
      totalExpenses: analyticsRows.totalExpenses,
    };
    const exportSummary: ExportSummary = {
      bank: summary.accountAssets,
      investments: summary.investments,
      otherAssets: summary.otherAssets,
      liabilities: summary.liabilities,
      netWorth: summary.netWorth,
    };
    const filenameDate = new Date().toISOString().slice(0, 10);

    if (params.get("format") === "csv") {
      const csv = createCsv(exportSummary, currency, analytics);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Ledgero-家庭財務報表-${filenameDate}.csv`)}`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = createWorkbook(exportSummary, currency, analytics);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Ledgero-家庭財務報表-${filenameDate}.xlsx`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[finance export] Failed to generate report", error);
    return Response.json({ error: "財務報表產生失敗，請稍後再試。" }, { status: 500 });
  }
}
