"use server";

import { revalidatePath } from "next/cache";

import { getFinanceContext } from "@/lib/finance/context";
import { getStockQuote } from "@/lib/finance/stock-price";
import type { Database } from "@/types/database";

type InvestmentRow = Database["public"]["Tables"]["investments"]["Row"];
type InvestmentInput = {
  accountId: string;
  symbol: string;
  name: string;
  shares: number;
  costPrice: number;
};

const investmentAccountTypes = new Set(["investment", "stock", "securities"]);

function validateInput(input: InvestmentInput) {
  const symbol = input.symbol.trim().toUpperCase();
  const name = input.name.trim();
  if (!input.accountId) return { error: "缺少投資帳戶。" };
  if (!symbol || symbol.length > 24) return { error: "請輸入有效的股票代號。" };
  if (name.length > 100) return { error: "股票名稱不可超過 100 個字。" };
  if (!Number.isFinite(input.shares) || input.shares <= 0) return { error: "股數必須大於 0。" };
  if (!Number.isFinite(input.costPrice) || input.costPrice <= 0) return { error: "買入單價必須大於 0。" };
  return { symbol, name, shares: input.shares, costPrice: input.costPrice };
}

async function getAuthorizedInvestmentAccount(accountId: string) {
  const result = await getFinanceContext();
  if (!result.context) return { error: result.error } as const;
  const { supabase, householdId } = result.context;
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", accountId)
    .eq("household_id", householdId)
    .single();
  if (error || !account) {
    return { error: error?.message ?? "找不到投資帳戶。" } as const;
  }
  if (!investmentAccountTypes.has(account.account_type)) {
    return { error: "股票明細只能新增至投資、股票或證券帳戶。" } as const;
  }
  return { context: result.context } as const;
}

function invalidateFinanceViews() {
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function createInvestment(input: InvestmentInput) {
  const fields = validateInput(input);
  if ("error" in fields) return { error: fields.error };
  const authorized = await getAuthorizedInvestmentAccount(input.accountId);
  if (!authorized.context) return { error: authorized.error };

  try {
    const quote = await getStockQuote(fields.symbol);
    const { error } = await authorized.context.supabase.from("investments").insert({
      account_id: input.accountId,
      symbol: quote.symbol,
      name: fields.name || quote.name,
      shares: fields.shares,
      cost_price: fields.costPrice,
      current_price: quote.price,
      currency: quote.currency,
      exchange_rate: quote.usdTwd,
      updated_at: quote.updatedAt,
    });
    if (error) {
      console.error("[investments] Create failed", { accountId: input.accountId, ...error });
      return {
        error: error.code === "23505"
          ? "此投資帳戶已存在相同股票代號。"
          : `新增股票失敗：${error.message}`,
      };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "無法取得股票報價。" };
  }

  invalidateFinanceViews();
  return { error: null };
}

export async function updateInvestment(id: string, input: InvestmentInput) {
  const fields = validateInput(input);
  if ("error" in fields) return { error: fields.error };
  if (!id) return { error: "缺少持倉 ID。" };
  const authorized = await getAuthorizedInvestmentAccount(input.accountId);
  if (!authorized.context) return { error: authorized.error };

  try {
    const quote = await getStockQuote(fields.symbol);
    const { error } = await authorized.context.supabase
      .from("investments")
      .update({
        symbol: quote.symbol,
        name: fields.name || quote.name,
        shares: fields.shares,
        cost_price: fields.costPrice,
        current_price: quote.price,
        currency: quote.currency,
        exchange_rate: quote.usdTwd,
        updated_at: quote.updatedAt,
      })
      .eq("id", id)
      .eq("account_id", input.accountId);
    if (error) {
      console.error("[investments] Update failed", { id, accountId: input.accountId, ...error });
      return {
        error: error.code === "23505"
          ? "此投資帳戶已存在相同股票代號。"
          : `更新股票失敗：${error.message}`,
      };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "無法取得股票報價。" };
  }

  invalidateFinanceViews();
  return { error: null };
}

export async function refreshInvestment(id: string, accountId: string) {
  if (!id || !accountId) return { error: "缺少持倉或帳戶 ID。" };
  const authorized = await getAuthorizedInvestmentAccount(accountId);
  if (!authorized.context) return { error: authorized.error };
  const { data: current, error: readError } = await authorized.context.supabase
    .from("investments")
    .select("symbol")
    .eq("id", id)
    .eq("account_id", accountId)
    .single();
  if (readError || !current) return { error: readError?.message ?? "找不到股票持倉。" };

  try {
    const quote = await getStockQuote(current.symbol);
    const { error } = await authorized.context.supabase
      .from("investments")
      .update({
        current_price: quote.price,
        currency: quote.currency,
        exchange_rate: quote.usdTwd,
        updated_at: quote.updatedAt,
      })
      .eq("id", id)
      .eq("account_id", accountId);
    if (error) {
      console.error("[investments] Refresh failed", { id, accountId, ...error });
      return { error: `更新股價失敗：${error.message}` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "無法取得股票報價。" };
  }

  invalidateFinanceViews();
  return { error: null };
}

export async function refreshAllInvestments() {
  const result = await getFinanceContext();
  if (!result.context) return { error: result.error, refreshed: 0, failed: [] as string[] };

  const { supabase } = result.context;
  const { data: investments, error: readError } = await supabase
    .from("investments")
    .select("id, account_id, symbol");
  if (readError) {
    console.error("[investments] Load all for refresh failed", readError);
    return { error: `讀取股票持倉失敗：${readError.message}`, refreshed: 0, failed: [] as string[] };
  }

  let refreshed = 0;
  const failed: string[] = [];
  for (let index = 0; index < (investments ?? []).length; index += 3) {
    const batch = (investments ?? []).slice(index, index + 3);
    await Promise.all(
      batch.map(async (investment) => {
        try {
          const quote = await getStockQuote(investment.symbol);
          const { error } = await supabase
            .from("investments")
            .update({
              current_price: quote.price,
              currency: quote.currency,
              exchange_rate: quote.usdTwd,
              updated_at: quote.updatedAt,
            })
            .eq("id", investment.id)
            .eq("account_id", investment.account_id);
          if (error) {
            console.error("[investments] Bulk quote update failed", {
              symbol: investment.symbol,
              ...error,
            });
            failed.push(investment.symbol);
            return;
          }
          refreshed += 1;
        } catch (error) {
          console.error("[investments] Bulk quote refresh failed", {
            symbol: investment.symbol,
            error,
          });
          failed.push(investment.symbol);
        }
      }),
    );
  }

  if (refreshed > 0) {
    revalidatePath("/");
    revalidatePath("/analytics");
  }
  return { error: null, refreshed, failed };
}

export async function deleteInvestment(id: string, accountId: string) {
  if (!id || !accountId) return { error: "缺少持倉或帳戶 ID。" };
  const authorized = await getAuthorizedInvestmentAccount(accountId);
  if (!authorized.context) return { error: authorized.error };
  const { error } = await authorized.context.supabase
    .from("investments")
    .delete()
    .eq("id", id)
    .eq("account_id", accountId);
  if (error) {
    console.error("[investments] Delete failed", { id, accountId, ...error });
    return { error: `刪除股票失敗：${error.message}` };
  }
  invalidateFinanceViews();
  return { error: null };
}

export type { InvestmentRow };
