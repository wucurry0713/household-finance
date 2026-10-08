import ExcelJS from "exceljs";

import { getFinanceContext } from "@/lib/finance/context";
import { loadTransactionReportRows } from "@/lib/finance/transaction-report";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinanceClient = NonNullable<
  Awaited<ReturnType<typeof getFinanceContext>>["context"]
>["supabase"];

type InvestmentRow = Database["public"]["Tables"]["investments"]["Row"];

async function loadPages<T>(
  readPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { code?: string; message: string } | null;
  }>,
  stage: string,
) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await readPage(offset, offset + pageSize - 1);
    if (error) {
      console.error(`[finance export] ${stage} query failed`, error);
      throw new Error(`${stage} query failed: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadInvestmentsSafely(supabase: FinanceClient): Promise<InvestmentRow[]> {
  try {
    return await loadPages<InvestmentRow>(
      (from, to) => supabase.from("investments").select("*").range(from, to),
      "investments",
    );
  } catch (error) {
    console.error("[finance export] investments query failed; using an empty portfolio", error);
    return [];
  }
}

async function loadAssetSummary(
  supabase: FinanceClient,
  householdId: string,
  currency: string,
) {
  type Account = Pick<
    Database["public"]["Tables"]["accounts"]["Row"],
    "id" | "account_type" | "currency" | "opening_balance" | "is_archived"
  >;
  type Entry = Pick<
    Database["public"]["Tables"]["transaction_entries"]["Row"],
    "account_id" | "amount_delta"
  >;
  type Asset = Pick<
    Database["public"]["Tables"]["assets"]["Row"],
    "id" | "asset_type" | "currency" | "purchase_price"
  >;
  type Valuation = Pick<
    Database["public"]["Tables"]["asset_valuations"]["Row"],
    "asset_id" | "value" | "valued_on"
  >;
  type Liability = Pick<
    Database["public"]["Tables"]["liabilities"]["Row"],
    "liability_type" | "currency" | "current_balance"
  >;
  type Holding = Pick<
    Database["public"]["Tables"]["holdings"]["Row"],
    "account_id" | "currency" | "quantity" | "current_price" | "average_cost"
  >;
  type Investment = Database["public"]["Tables"]["investments"]["Row"];

  const convertInvestmentValue = (investment: Investment, targetCurrency: string) => {
    const marketValue = Number(investment.shares) * Number(investment.current_price);
    if (investment.currency === targetCurrency) return marketValue;
    if (investment.currency === "USD" && targetCurrency === "TWD") {
      return marketValue * Number(investment.exchange_rate);
    }
    if (investment.currency === "TWD" && targetCurrency === "USD") {
      return marketValue / Number(investment.exchange_rate);
    }
    return marketValue;
  };

  const [accounts, entries, assets, valuations, liabilities, holdings, investments] = await Promise.all([
    loadPages<Account>(
      (from, to) =>
        supabase
          .from("accounts")
          .select("id, account_type, currency, opening_balance, is_archived")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .range(from, to),
      "accounts",
    ),
    loadPages<Entry>(
      (from, to) =>
        supabase
          .from("transaction_entries")
          .select("account_id, amount_delta")
          .eq("household_id", householdId)
          .range(from, to),
      "transaction entries",
    ),
    loadPages<Asset>(
      (from, to) =>
        supabase
          .from("assets")
          .select("id, asset_type, currency, purchase_price")
          .eq("household_id", householdId)
          .range(from, to),
      "assets",
    ),
    loadPages<Valuation>(
      (from, to) =>
        supabase
          .from("asset_valuations")
          .select("asset_id, value, valued_on")
          .eq("household_id", householdId)
          .order("valued_on", { ascending: false })
          .range(from, to),
      "asset valuations",
    ),
    loadPages<Liability>(
      (from, to) =>
        supabase
          .from("liabilities")
          .select("liability_type, currency, current_balance")
          .eq("household_id", householdId)
          .range(from, to),
      "liabilities",
    ),
    loadPages<Holding>(
      (from, to) =>
        supabase
          .from("holdings")
          .select("account_id, currency, quantity, current_price, average_cost")
          .eq("household_id", householdId)
          .range(from, to),
      "holdings",
    ),
    loadInvestmentsSafely(supabase),
  ]);

  const balances = new Map<string, number>(
    accounts.map((account) => [account.id, Number(account.opening_balance)]),
  );
  for (const entry of entries) {
    if (balances.has(entry.account_id)) {
      balances.set(
        entry.account_id,
        (balances.get(entry.account_id) ?? 0) + Number(entry.amount_delta),
      );
    }
  }

  const investmentsByAccount = new Map<string, Investment[]>();
  for (const investment of investments) {
    const bucket = investmentsByAccount.get(investment.account_id) ?? [];
    bucket.push(investment);
    investmentsByAccount.set(investment.account_id, bucket);
  }
  const portfolioAccountIds = new Set(investmentsByAccount.keys());
  for (const account of accounts) {
    const positions = investmentsByAccount.get(account.id);
    if (positions) {
      balances.set(
        account.id,
        positions.reduce(
          (sum, investment) => sum + convertInvestmentValue(investment, account.currency),
          0,
        ),
      );
    }
  }

  const liabilityAccountTypes = new Set(["loan", "liability"]);
  const investmentAccountTypes = new Set(["investment", "stock", "securities"]);
  const totalAssetAccounts = accounts
    .filter(
      (account) =>
        account.currency === currency && !liabilityAccountTypes.has(account.account_type),
    )
    .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
  const investmentAccounts = accounts
    .filter(
      (account) =>
        account.currency === currency &&
        investmentAccountTypes.has(account.account_type) &&
        !portfolioAccountIds.has(account.id),
    )
    .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
  const portfolioValue = investments.reduce(
    (sum, investment) => sum + convertInvestmentValue(investment, currency),
    0,
  );
  const accountLiabilities = accounts
    .filter(
      (account) =>
        account.currency === currency && liabilityAccountTypes.has(account.account_type),
    )
    .reduce((sum, account) => sum + Math.abs(balances.get(account.id) ?? 0), 0);
  const holdingValue = holdings
    .filter(
      (holding) =>
        holding.currency === currency &&
        (!holding.account_id || !portfolioAccountIds.has(holding.account_id)),
    )
    .reduce(
      (sum, holding) =>
        sum +
        Number(holding.quantity) *
          Number(holding.current_price ?? holding.average_cost ?? 0),
      0,
    );
  const latestValuations = new Map<string, number>();
  for (const valuation of valuations) {
    if (!latestValuations.has(valuation.asset_id)) {
      latestValuations.set(valuation.asset_id, Number(valuation.value));
    }
  }
  const assetValue = assets
    .filter((asset) => asset.currency === currency)
    .reduce(
      (sum, asset) =>
        sum + (latestValuations.get(asset.id) ?? Number(asset.purchase_price ?? 0)),
      0,
    );
  const realEstateValue = assets
    .filter((asset) => asset.currency === currency && asset.asset_type === "real_estate")
    .reduce(
      (sum, asset) =>
        sum + (latestValuations.get(asset.id) ?? Number(asset.purchase_price ?? 0)),
      0,
    );
  const liabilityValue = liabilities
    .filter((liability) => liability.currency === currency)
    .reduce((sum, liability) => sum + Math.abs(Number(liability.current_balance)), 0) +
    accountLiabilities;
  const mortgageValue = liabilities
    .filter(
      (liability) =>
        liability.currency === currency && liability.liability_type === "mortgage",
    )
    .reduce((sum, liability) => sum + Math.abs(Number(liability.current_balance)), 0);

  return {
    bank: accounts
      .filter(
        (account) =>
          account.currency === currency &&
          (account.account_type === "bank" || account.account_type === "cash"),
      )
      .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0),
    investments: investmentAccounts + portfolioValue + holdingValue,
    realEstate: realEstateValue,
    mortgage: mortgageValue,
    otherAssets: assetValue - realEstateValue,
    liabilities: liabilityValue,
    netWorth: totalAssetAccounts + assetValue + holdingValue - liabilityValue,
  };
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1D6048" },
  };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  header.height = 24;
}

export async function GET() {
  const result = await getFinanceContext();
  if (!result.context) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  try {
    const { supabase, householdId } = result.context;
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
    const [summary, reportRows] = await Promise.all([
      loadAssetSummary(supabase, householdId, currency),
      loadTransactionReportRows(supabase, householdId),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ledgero";
    workbook.created = new Date();

    const assetsSheet = workbook.addWorksheet("資產負債總覽");
    assetsSheet.columns = [
      { header: "項目", key: "item", width: 28 },
      { header: "金額", key: "amount", width: 20 },
      { header: "幣別", key: "currency", width: 12 },
    ];
    [
      ["銀行存款與現金", summary.bank],
      ["投資部位", summary.investments],
      ["房地產資產", summary.realEstate],
      ["其他資產", summary.otherAssets],
      ["房貸負債", -summary.mortgage],
      ["其他負債", -(summary.liabilities - summary.mortgage)],
      ["淨資產總計", summary.netWorth],
    ].forEach(([item, amount]) =>
      assetsSheet.addRow({ item, amount, currency }),
    );
    assetsSheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
    styleHeader(assetsSheet);

    const monthlySheet = workbook.addWorksheet("月度收支統計");
    monthlySheet.columns = [
      { header: "月份", key: "month", width: 14 },
      { header: "收支類型", key: "kind", width: 14 },
      { header: "大類別 / 子分類", key: "category", width: 34 },
      { header: "金額", key: "amount", width: 18 },
      { header: "幣別", key: "currency", width: 12 },
    ];
    const monthlyTotals = new Map<
      string,
      { month: string; kind: string; category: string; amount: number; currency: string }
    >();
    for (const row of reportRows) {
      const month = row.date.slice(0, 7);
      const key = `${month}|${row.kind}|${row.category}|${row.currency}`;
      const bucket = monthlyTotals.get(key) ?? {
        month,
        kind: row.kind === "income" ? "收入" : "支出",
        category: row.category,
        amount: 0,
        currency: row.currency,
      };
      bucket.amount += row.kind === "expense" ? -row.amount : row.amount;
      monthlyTotals.set(key, bucket);
    }
    [...monthlyTotals.values()]
      .sort(
        (a, b) =>
          a.month.localeCompare(b.month) ||
          a.kind.localeCompare(b.kind, "zh-Hant") ||
          a.category.localeCompare(b.category, "zh-Hant"),
      )
      .forEach((row) => monthlySheet.addRow(row));
    monthlySheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
    styleHeader(monthlySheet);
    if (monthlyTotals.size) {
      monthlySheet.autoFilter = {
        from: "A1",
        to: `E${monthlyTotals.size + 1}`,
      };
    }

    const transactionsSheet = workbook.addWorksheet("交易明細列表");
    transactionsSheet.columns = [
      { header: "日期", key: "date", width: 14 },
      { header: "類型", key: "kind", width: 12 },
      { header: "分類", key: "category", width: 34 },
      { header: "金額", key: "amount", width: 18 },
      { header: "幣別", key: "currency", width: 12 },
      { header: "帳戶", key: "account", width: 28 },
      { header: "交易說明", key: "description", width: 32 },
      { header: "備註", key: "notes", width: 32 },
    ];
    for (const row of reportRows) {
      transactionsSheet.addRow({
        ...row,
        kind: row.kind === "income" ? "收入" : "支出",
        amount: row.kind === "expense" ? -row.amount : row.amount,
      });
    }
    transactionsSheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
    styleHeader(transactionsSheet);
    if (reportRows.length) {
      transactionsSheet.autoFilter = {
        from: "A1",
        to: `H${reportRows.length + 1}`,
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Ledgero-家庭財務報表-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[finance export] Failed to generate workbook", error);
    return Response.json({ error: "Excel 報表產生失敗，請稍後再試。" }, { status: 500 });
  }
}
