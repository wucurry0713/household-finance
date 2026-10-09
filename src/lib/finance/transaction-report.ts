import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { StoredExpenseScope } from "@/lib/finance/expense-scope";

type FinanceClient = SupabaseClient<Database>;
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type EntryRow = Database["public"]["Tables"]["transaction_entries"]["Row"];
type SplitRow = Database["public"]["Tables"]["transaction_splits"]["Row"];
type CategoryLabel = {
  id: string;
  name: string;
  parent_category_id?: string | null;
};

export type TransactionReportRow = {
  date: string;
  kind: "income" | "expense";
  scope: StoredExpenseScope;
  amount: number;
  currency: string;
  category: string;
  categoryId: string | null;
  account: string;
  description: string;
  notes: string;
};

function throwQueryError(stage: string, error: { code?: string; message: string }): never {
  console.error(`[finance report] ${stage} query failed`, {
    code: error.code,
    message: error.message,
  });
  throw new Error(`${stage} query failed: ${error.message}`);
}

async function loadAllTransactions(
  supabase: FinanceClient,
  householdId: string,
  sinceDate?: string,
  untilDate?: string,
) {
  const transactions: Pick<
    TransactionRow,
    | "id"
    | "kind"
    | "scope"
    | "transaction_date"
    | "currency"
    | "description"
    | "notes"
    | "created_at"
  >[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("transactions")
      .select("id, kind, scope, transaction_date, currency, description, notes, created_at")
      .eq("household_id", householdId)
      .in("kind", ["income", "expense"])
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (sinceDate) query = query.gte("transaction_date", sinceDate);
    if (untilDate) query = query.lt("transaction_date", untilDate);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throwQueryError("transactions", error);
    transactions.push(...data);
    if (data.length < pageSize) break;
  }

  return transactions;
}

export async function loadTransactionReportRows(
  supabase: FinanceClient,
  householdId: string,
  sinceDate?: string,
  untilDate?: string,
): Promise<TransactionReportRow[]> {
  const [transactions, categoryResult] = await Promise.all([
    loadAllTransactions(supabase, householdId, sinceDate, untilDate),
    supabase
      .from("categories")
      .select("id, name, parent_category_id, kind, household_id")
      .or(`household_id.is.null,household_id.eq.${householdId}`),
  ]);

  let categoryRows: CategoryLabel[] = categoryResult.data ?? [];
  let hasParentCategories = true;
  if (categoryResult.error) {
    console.error("[finance report] categories hierarchy query failed; retrying without parent categories", {
      code: categoryResult.error.code,
      message: categoryResult.error.message,
    });
    const fallbackResult = await supabase
      .from("categories")
      .select("id, name, kind, household_id")
      .or(`household_id.is.null,household_id.eq.${householdId}`);
    if (fallbackResult.error) {
      console.error("[finance report] categories fallback query failed; transactions will be uncategorized", {
        code: fallbackResult.error.code,
        message: fallbackResult.error.message,
      });
      categoryRows = [];
    } else {
      categoryRows = fallbackResult.data ?? [];
    }
    hasParentCategories = false;
  }

  const transactionIds = transactions.map((transaction) => transaction.id);
  const entries: EntryRow[] = [];
  const splits: SplitRow[] = [];
  for (let offset = 0; offset < transactionIds.length; offset += 100) {
    const ids = transactionIds.slice(offset, offset + 100);
    const [entriesResult, splitsResult] = await Promise.all([
      supabase
        .from("transaction_entries")
        .select("*")
        .eq("household_id", householdId)
        .in("transaction_id", ids),
      supabase
        .from("transaction_splits")
        .select("*")
        .eq("household_id", householdId)
        .in("transaction_id", ids),
    ]);
    if (entriesResult.error) throwQueryError("transaction entries", entriesResult.error);
    if (splitsResult.error) throwQueryError("transaction splits", splitsResult.error);
    entries.push(...entriesResult.data);
    splits.push(...splitsResult.data);
  }

  const accountIds = [...new Set(entries.map((entry) => entry.account_id))];
  const accountResult = accountIds.length
    ? await supabase
        .from("accounts")
        .select("id, name")
        .eq("household_id", householdId)
        .in("id", accountIds)
    : { data: [], error: null };
  if (accountResult.error) throwQueryError("accounts", accountResult.error);

  const categories = categoryRows ?? [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryNames = new Map(
    categories.map((category) => {
      const parent = hasParentCategories && category.parent_category_id
        ? categoriesById.get(category.parent_category_id)
        : null;
      return [
        category.id,
        parent ? `${parent.name} / ${category.name}` : category.name,
      ];
    }),
  );
  const accountsById = new Map((accountResult.data ?? []).map((account) => [account.id, account.name]));
  const entriesByTransaction = new Map<string, EntryRow[]>();
  const splitsByTransaction = new Map<string, SplitRow[]>();

  for (const entry of entries) {
    const bucket = entriesByTransaction.get(entry.transaction_id) ?? [];
    bucket.push(entry);
    entriesByTransaction.set(entry.transaction_id, bucket);
  }
  for (const split of splits) {
    const bucket = splitsByTransaction.get(split.transaction_id) ?? [];
    bucket.push(split);
    splitsByTransaction.set(split.transaction_id, bucket);
  }

  return transactions.flatMap((transaction) => {
    const transactionEntries = entriesByTransaction.get(transaction.id) ?? [];
    const transactionSplits = splitsByTransaction.get(transaction.id) ?? [];
    const amount = transactionEntries.reduce(
      (sum, entry) => sum + Math.abs(Number(entry.amount_delta)),
      0,
    );
    const account = [
      ...new Set(
        transactionEntries
          .map((entry) => accountsById.get(entry.account_id))
          .filter((name): name is string => Boolean(name)),
      ),
    ].join(" → ");
    const categorySplits = transactionSplits.length
      ? transactionSplits
      : [{ category_id: null, amount, note: null }];

    return categorySplits.map((split) => ({
      date: transaction.transaction_date,
      kind: transaction.kind as "income" | "expense",
      scope: transaction.scope,
      amount: Number(split.amount),
      currency: transaction.currency,
      category: split.category_id
        ? categoryNames.get(split.category_id) ?? "未分類"
        : "未分類",
      categoryId: split.category_id,
      account,
      description: transaction.description,
      notes: [transaction.notes, split.note].filter(Boolean).join(" / "),
    }));
  });
}
