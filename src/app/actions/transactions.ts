"use server";

import { revalidatePath } from "next/cache";

import { getFinanceContext } from "@/lib/finance/context";
import type { Database } from "@/types/database";

export type TransactionActionState = {
  error: string | null;
  success: boolean;
  intent: "continue" | "close" | null;
};

type TransactionKind = "income" | "expense" | "transfer";
type TransactionInput = {
  kind: TransactionKind;
  amount: number;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  transactionDate: string;
  notes: string | null;
  currency: string;
};

const failed = (
  error: string,
  intent: TransactionActionState["intent"] = null,
): TransactionActionState => ({ error, success: false, intent });

function parseTransactionInput(formData: FormData):
  | { input: TransactionInput; error: null }
  | { input: null; error: string } {
  const kind = formData.get("kind");
  const amount = Number(formData.get("amount"));
  const accountId = String(formData.get("account_id") ?? "");
  const destinationAccountId = String(formData.get("destination_account_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const transactionDate = String(formData.get("transaction_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (kind !== "income" && kind !== "expense" && kind !== "transfer") {
    return { input: null, error: "請選擇有效的交易類型。" };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    return { input: null, error: "金額必須大於 0，且不可超過上限。" };
  }
  if (!accountId) return { input: null, error: "請選擇帳戶。" };
  if (kind === "transfer" && !destinationAccountId) {
    return { input: null, error: "轉帳請選擇轉入帳戶。" };
  }
  if (kind === "transfer" && accountId === destinationAccountId) {
    return { input: null, error: "轉出與轉入帳戶不可相同。" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    return { input: null, error: "請選擇有效日期。" };
  }
  const parsedDate = new Date(`${transactionDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== transactionDate) {
    return { input: null, error: "請選擇有效日期。" };
  }

  return {
    input: {
      kind,
      amount: Math.round(amount * 1_000_000) / 1_000_000,
      accountId,
      destinationAccountId: kind === "transfer" ? destinationAccountId : null,
      categoryId: kind === "transfer" || !categoryId ? null : categoryId,
      transactionDate,
      notes: notes || null,
      currency: "TWD",
    },
    error: null,
  };
}

async function validateAccounts(
  input: TransactionInput,
  householdId: string,
  supabase: Awaited<ReturnType<typeof getFinanceContext>> extends { context: infer C }
    ? C extends { supabase: infer S }
      ? S
      : never
    : never,
) {
  const accountIds = [input.accountId, input.destinationAccountId].filter(
    (id): id is string => id !== null,
  );
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, currency, is_archived, is_joint")
    .eq("household_id", householdId)
    .in("id", accountIds);

  if (error) return { error: error.message, currency: null };
  if (!accounts || accounts.length !== accountIds.length) {
    return { error: "選取的帳戶不存在或不屬於目前家庭。", currency: null };
  }
  if (accounts.some((account) => account.is_archived)) {
    return { error: "封存中的帳戶不能新增交易。", currency: null };
  }
  if (accounts.some((account) => account.currency !== accounts[0].currency)) {
    return { error: "轉帳兩側帳戶幣別必須相同。", currency: null };
  }

  return {
    error: null,
    currency: accounts[0].currency,
    isJoint: accounts.every((account) => account.is_joint),
  };
}

async function validateCategory(
  categoryId: string | null,
  kind: TransactionKind,
  householdId: string,
  supabase: Awaited<ReturnType<typeof getFinanceContext>> extends { context: infer C }
    ? C extends { supabase: infer S }
      ? S
      : never
    : never,
) {
  if (!categoryId || kind === "transfer") return { category: null, error: null };

  const { data: category, error } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("id", categoryId)
    .eq("kind", kind)
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .maybeSingle();

  if (error) return { category: null, error: error.message };
  if (!category) return { category: null, error: "所選分類不存在或類型不符。" };
  return { category, error: null };
}

function buildEntries(
  input: TransactionInput,
  householdId: string,
  transactionId: string,
): Database["public"]["Tables"]["transaction_entries"]["Insert"][] {
  if (input.kind === "transfer" && input.destinationAccountId) {
    return [
      {
        household_id: householdId,
        transaction_id: transactionId,
        account_id: input.accountId,
        amount_delta: -input.amount,
      },
      {
        household_id: householdId,
        transaction_id: transactionId,
        account_id: input.destinationAccountId,
        amount_delta: input.amount,
      },
    ];
  }

  return [
    {
      household_id: householdId,
      transaction_id: transactionId,
      account_id: input.accountId,
      amount_delta: input.kind === "income" ? input.amount : -input.amount,
    },
  ];
}

async function writeTransactionDetails(
  supabase: NonNullable<Awaited<ReturnType<typeof getFinanceContext>>["context"]>["supabase"],
  input: TransactionInput,
  householdId: string,
  transactionId: string,
  userId: string,
  category: { id: string; name: string } | null,
) {
  const { error: entriesError } = await supabase
    .from("transaction_entries")
    .insert(buildEntries(input, householdId, transactionId));
  if (entriesError) return entriesError;

  if (category) {
    const { error: splitError } = await supabase.from("transaction_splits").insert({
      household_id: householdId,
      transaction_id: transactionId,
      category_id: category.id,
      member_user_id: userId,
      amount: input.amount,
      note: input.notes,
    });
    if (splitError) return splitError;
  }

  return null;
}

function transactionDescription(input: TransactionInput, categoryName: string | null) {
  return input.notes || categoryName || (input.kind === "transfer" ? "帳戶轉帳" : "未分類");
}

async function resolveInput(
  formData: FormData,
  householdId: string,
  supabase: NonNullable<Awaited<ReturnType<typeof getFinanceContext>>["context"]>["supabase"],
) {
  const parsed = parseTransactionInput(formData);
  if (!parsed.input) return { input: null, error: parsed.error, category: null };

  const accountCheck = await validateAccounts(parsed.input, householdId, supabase);
  if (accountCheck.error || !accountCheck.currency) {
    return {
      input: null,
      error: accountCheck.error ?? "無法確認帳戶幣別。",
      category: null,
      isJoint: false,
    };
  }

  const categoryCheck = await validateCategory(
    parsed.input.categoryId,
    parsed.input.kind,
    householdId,
    supabase,
  );
  if (categoryCheck.error) {
    return { input: null, error: categoryCheck.error, category: null, isJoint: false };
  }

  return {
    input: { ...parsed.input, currency: accountCheck.currency },
    error: null,
    category: categoryCheck.category,
    isJoint: accountCheck.isJoint,
  };
}

export async function createTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const intent = formData.get("intent") === "continue" ? "continue" : "close";
  const contextResult = await getFinanceContext();
  if (!contextResult.context) return failed(contextResult.error, intent);

  const { supabase, user, householdId } = contextResult.context;
  const resolved = await resolveInput(formData, householdId, supabase);
  if (!resolved.input) return failed(resolved.error ?? "交易資料無效。", intent);

  const input = resolved.input;
  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: transactionError } = await supabase.from("transactions").insert({
    id: transactionId,
    household_id: householdId,
    created_by: user.id,
    paid_by_user_id: user.id,
    owner_id: user.id,
    is_joint: resolved.isJoint,
    kind: input.kind,
    transaction_date: input.transactionDate,
    currency: input.currency,
    description: transactionDescription(input, resolved.category?.name ?? null),
    notes: input.notes,
    created_at: now,
    updated_at: now,
  });

  if (transactionError) {
    console.error("[transactions] Create header failed", transactionError);
    return failed(transactionError.message, intent);
  }

  const detailsError = await writeTransactionDetails(
    supabase,
    input,
    householdId,
    transactionId,
    user.id,
    resolved.category,
  );

  if (detailsError) {
    console.error("[transactions] Create entries/splits failed", detailsError);
    const { error: rollbackError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("household_id", householdId);
    if (rollbackError) console.error("[transactions] Create rollback failed", rollbackError);
    return failed(detailsError.message, intent);
  }

  revalidatePath("/");
  return { error: null, success: true, intent };
}

export async function updateTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = String(formData.get("transaction_id") ?? "");
  if (!transactionId) return failed("缺少交易 ID。");

  const contextResult = await getFinanceContext();
  if (!contextResult.context) return failed(contextResult.error);
  const { supabase, user, householdId } = contextResult.context;

  const resolved = await resolveInput(formData, householdId, supabase);
  if (!resolved.input) return failed(resolved.error ?? "交易資料無效。");

  const { data: oldTransaction, error: transactionReadError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (transactionReadError) return failed(transactionReadError.message);
  if (!oldTransaction) return failed("找不到這筆交易。");

  const [{ data: oldEntries, error: entriesReadError }, { data: oldSplits, error: splitsReadError }] =
    await Promise.all([
      supabase
        .from("transaction_entries")
        .select("*")
        .eq("transaction_id", transactionId)
        .eq("household_id", householdId),
      supabase
        .from("transaction_splits")
        .select("*")
        .eq("transaction_id", transactionId)
        .eq("household_id", householdId),
    ]);
  if (entriesReadError) return failed(entriesReadError.message);
  if (splitsReadError) return failed(splitsReadError.message);

  const input = resolved.input;
  const { error: headerError } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      paid_by_user_id: user.id,
      owner_id: user.id,
      is_joint: resolved.isJoint,
      transaction_date: input.transactionDate,
      currency: input.currency,
      description: transactionDescription(input, resolved.category?.name ?? null),
      notes: input.notes,
    })
    .eq("id", transactionId)
    .eq("household_id", householdId);
  if (headerError) return failed(headerError.message);

  const restoreOriginal = async () => {
    await supabase
      .from("transaction_entries")
      .delete()
      .eq("transaction_id", transactionId)
      .eq("household_id", householdId);
    await supabase
      .from("transaction_splits")
      .delete()
      .eq("transaction_id", transactionId)
      .eq("household_id", householdId);
    await supabase
      .from("transactions")
      .update({
        kind: oldTransaction.kind,
        paid_by_user_id: oldTransaction.paid_by_user_id,
        owner_id: oldTransaction.owner_id,
        is_joint: oldTransaction.is_joint,
        transaction_date: oldTransaction.transaction_date,
        currency: oldTransaction.currency,
        description: oldTransaction.description,
        notes: oldTransaction.notes,
      })
      .eq("id", transactionId)
      .eq("household_id", householdId);
    if (oldEntries?.length) await supabase.from("transaction_entries").insert(oldEntries);
    if (oldSplits?.length) await supabase.from("transaction_splits").insert(oldSplits);
  };

  const { error: deleteEntriesError } = await supabase
    .from("transaction_entries")
    .delete()
    .eq("transaction_id", transactionId)
    .eq("household_id", householdId);
  if (deleteEntriesError) {
    await restoreOriginal();
    return failed(deleteEntriesError.message);
  }

  const { error: deleteSplitsError } = await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId)
    .eq("household_id", householdId);
  if (deleteSplitsError) {
    await restoreOriginal();
    return failed(deleteSplitsError.message);
  }

  const detailsError = await writeTransactionDetails(
    supabase,
    input,
    householdId,
    transactionId,
    user.id,
    resolved.category,
  );
  if (detailsError) {
    console.error("[transactions] Update entries/splits failed; restoring old values", detailsError);
    await restoreOriginal();
    return failed(detailsError.message);
  }

  revalidatePath("/");
  return { error: null, success: true, intent: null };
}

export async function deleteTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = String(formData.get("transaction_id") ?? "");
  if (!transactionId) return failed("缺少交易 ID。");

  const contextResult = await getFinanceContext();
  if (!contextResult.context) return failed(contextResult.error);

  const { error } = await contextResult.context.supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("household_id", contextResult.context.householdId);

  if (error) {
    console.error("[transactions] Delete failed", { transactionId, ...error });
    return failed(error.message);
  }

  revalidatePath("/");
  return { error: null, success: true, intent: null };
}

export async function getTransactionsForHousehold(householdId: string) {
  const contextResult = await getFinanceContext();
  if (!contextResult.context || contextResult.context.householdId !== householdId) {
    return { data: [], error: contextResult.error ?? "無權讀取此家庭交易。" };
  }

  const { data, error } = await contextResult.context.supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[transactions] List failed", error);
    return { data: [], error: error.message };
  }

  return { data, error: null };
}

export type TransactionExportRow = {
  date: string;
  kind: string;
  amount: number;
  currency: string;
  category: string;
  account: string;
  owner: string;
  notes: string;
};

export async function exportTransactionsAction(
  scope: "current_month" | "month" | "all",
  selectedMonth: string,
  viewOwnerId: string | null,
): Promise<{ rows: TransactionExportRow[] | null; error: string | null }> {
  const contextResult = await getFinanceContext();
  if (!contextResult.context) return { rows: null, error: contextResult.error };
  const { supabase, householdId } = contextResult.context;

  if (scope !== "current_month" && scope !== "month" && scope !== "all") {
    return { rows: null, error: "請選擇有效的匯出範圍。" };
  }

  if (viewOwnerId) {
    const { data: member, error } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .eq("user_id", viewOwnerId)
      .eq("status", "active")
      .maybeSingle();
    if (error) return { rows: null, error: error.message };
    if (!member) return { rows: null, error: "無權匯出此成員的交易。" };
  }

  let fromDate: string | null = null;
  let toDate: string | null = null;
  if (scope === "current_month") {
    const now = new Date();
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
    toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
  } else if (scope === "month") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
      return { rows: null, error: "請選擇有效月份。" };
    }
    const [yearText, monthText] = selectedMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    fromDate = `${selectedMonth}-01`;
    toDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }

  type ExportTransaction = Pick<
    Database["public"]["Tables"]["transactions"]["Row"],
    | "id"
    | "household_id"
    | "created_by"
    | "owner_id"
    | "is_joint"
    | "kind"
    | "transaction_date"
    | "currency"
    | "description"
    | "notes"
    | "created_at"
  >;

  const transactions: ExportTransaction[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("transactions")
      .select(
        "id, household_id, created_by, owner_id, is_joint, kind, transaction_date, currency, description, notes, created_at",
      )
      .eq("household_id", householdId);

    if (fromDate && toDate) {
      query = query.gte("transaction_date", fromDate).lte("transaction_date", toDate);
    }
    if (viewOwnerId) {
      query = query.or(`is_joint.eq.true,owner_id.eq.${viewOwnerId}`);
    }

    const { data, error } = await query
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[transactions] CSV export query failed", error);
      return { rows: null, error: `讀取交易失敗：${error.message}` };
    }

    transactions.push(...data);
    if (data.length < pageSize) break;
  }

  const entries: Database["public"]["Tables"]["transaction_entries"]["Row"][] = [];
  const splits: Database["public"]["Tables"]["transaction_splits"]["Row"][] = [];
  for (let offset = 0; offset < transactions.length; offset += 100) {
    const transactionIds = transactions.slice(offset, offset + 100).map((transaction) => transaction.id);
    const [entriesResult, splitsResult] = await Promise.all([
      supabase
        .from("transaction_entries")
        .select("*")
        .eq("household_id", householdId)
        .in("transaction_id", transactionIds),
      supabase
        .from("transaction_splits")
        .select("*")
        .eq("household_id", householdId)
        .in("transaction_id", transactionIds),
    ]);
    if (entriesResult.error) return { rows: null, error: entriesResult.error.message };
    if (splitsResult.error) return { rows: null, error: splitsResult.error.message };
    entries.push(...(entriesResult.data ?? []));
    splits.push(...(splitsResult.data ?? []));
  }

  const accountIds = [...new Set(entries.map((entry) => entry.account_id))];
  const categoryIds = [...new Set(splits.flatMap((split) => split.category_id ?? []))];
  const ownerIds = [...new Set(transactions.map((transaction) => transaction.owner_id ?? transaction.created_by))];
  const [accountsResult, categoriesResult, usersResult] = await Promise.all([
    accountIds.length
      ? supabase.from("accounts").select("id, name").eq("household_id", householdId).in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? supabase.from("users").select("id, display_name").in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const error of [accountsResult.error, categoriesResult.error, usersResult.error]) {
    if (error) {
      console.error("[transactions] CSV export labels query failed", error);
      return { rows: null, error: `讀取報表欄位失敗：${error.message}` };
    }
  }

  const accountNames = new Map((accountsResult.data ?? []).map((account) => [account.id, account.name]));
  const categoryNames = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  const ownerNames = new Map((usersResult.data ?? []).map((user) => [user.id, user.display_name]));
  const entriesByTransaction = new Map<string, typeof entries>();
  const splitsByTransaction = new Map<string, typeof splits>();
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

  const rows = transactions.map((transaction) => {
    const transactionEntries = entriesByTransaction.get(transaction.id) ?? [];
    const source = transactionEntries.find((entry) =>
      transaction.kind === "transfer" ? Number(entry.amount_delta) < 0 : true,
    );
    const destination = transaction.kind === "transfer"
      ? transactionEntries.find((entry) => Number(entry.amount_delta) > 0)
      : null;
    const amount = transactionEntries.reduce((sum, entry) => {
      const delta = Number(entry.amount_delta);
      if (transaction.kind === "transfer") return delta < 0 ? sum + Math.abs(delta) : sum;
      return sum + Math.abs(delta);
    }, 0);
    const categoryIdsForTransaction = [
      ...new Set(
        (splitsByTransaction.get(transaction.id) ?? [])
          .map((split) => split.category_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const sourceName = source ? accountNames.get(source.account_id) ?? "" : "";
    const accountName = destination
      ? `${sourceName} → ${accountNames.get(destination.account_id) ?? ""}`
      : sourceName;
    const ownerId = transaction.owner_id ?? transaction.created_by;

    return {
      date: transaction.transaction_date,
      kind:
        transaction.kind === "expense"
          ? "支出"
          : transaction.kind === "income"
            ? "收入"
            : transaction.kind === "transfer"
              ? "轉帳"
              : "調整",
      amount,
      currency: transaction.currency,
      category: categoryIdsForTransaction
        .map((id) => categoryNames.get(id))
        .filter(Boolean)
        .join("、"),
      account: accountName,
      owner: ownerNames.get(ownerId) || ownerId,
      notes: transaction.notes || transaction.description || "",
    };
  });

  return { rows, error: null };
}