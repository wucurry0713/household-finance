import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { monthDateRange } from "@/lib/finance/month";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type EntryRow = Database["public"]["Tables"]["transaction_entries"]["Row"];

const cashAccountTypes: ReadonlySet<string> = new Set(["bank", "cash"]);
const investmentAccountTypes: ReadonlySet<string> = new Set([
  "investment",
  "stock",
  "securities",
]);
const otherAssetAccountTypes: ReadonlySet<string> = new Set([
  "asset",
  "real_estate",
  "vehicle",
]);
const liabilityAccountTypes: ReadonlySet<string> = new Set([
  "loan",
  "liability",
]);
const otherAssetNamePattern = /房地產|車子|房屋/;

function isOtherAssetAccount(account: DashboardAccount) {
  return (
    otherAssetAccountTypes.has(account.account_type) ||
    (!investmentAccountTypes.has(account.account_type) &&
      !liabilityAccountTypes.has(account.account_type) &&
      otherAssetNamePattern.test(account.name))
  );
}

export type DashboardAccount = AccountRow & { balance: number };

export type DashboardMember = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
};

export type DashboardTotals = {
  netWorth: number;
  monthIncome: number;
  monthExpenses: number;
  monthBalance: number;
  accountAssets: number;
  otherAssets: number;
  investments: number;
  liabilities: number;
};

export type DashboardMonthTransaction = {
  id: string;
  kind: "income" | "expense" | "transfer" | "adjustment";
  owner_id: string | null;
  is_joint: boolean;
  amount: number;
};

export type DashboardTransaction = Omit<TransactionRow, "kind"> & {
  kind: "income" | "expense" | "transfer";
  amount: number;
  categoryName: string | null;
  categoryId: string | null;
  accountName: string | null;
  accountId: string | null;
  destinationName: string | null;
  destinationAccountId: string | null;
};

export type DashboardData = {
  accounts: DashboardAccount[];
  defaultAccountId: string | null;
  categories: CategoryRow[];
  members: DashboardMember[];
  pendingInvitations: { id: string; email: string; created_at: string }[];
  monthTransactions: DashboardMonthTransaction[];
  recentTransactions: DashboardTransaction[];
  totals: DashboardTotals;
  memberTotals: Record<string, DashboardTotals>;
};

function reportError(stage: string, error: { code?: string; message: string }) {
  console.error(`[dashboard] ${stage} query failed`, {
    code: error.code,
    message: error.message,
  });
}

async function loadMonthTransactions(
  supabase: SupabaseClient<Database>,
  householdId: string,
  monthStart: string,
  monthEnd: string,
) {
  const transactions: TransactionRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("household_id", householdId)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      reportError("month transactions", error);
      throw new Error(`Month transaction query failed: ${error.message}`);
    }
    transactions.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return transactions;
}

export async function loadDashboardData(
  supabase: SupabaseClient<Database>,
  householdId: string,
  userId: string,
  baseCurrency: string,
  selectedMonth: string,
): Promise<DashboardData> {
  const { start: monthStart, end: monthEnd } = monthDateRange(selectedMonth);

  const [
    accountsResult,
    entriesResult,
    monthTransactions,
    categoriesResult,
    assetsResult,
    valuationsResult,
    liabilitiesResult,
    holdingsResult,
    preferencesResult,
    membersResult,
    invitationsResult,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("transaction_entries")
      .select("*")
      .eq("household_id", householdId),
    loadMonthTransactions(supabase, householdId, monthStart, monthEnd),
    supabase
      .from("categories")
      .select("*")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("name", { ascending: true }),
    supabase
      .from("assets")
      .select("id, owner_id, is_joint, currency, purchase_price")
      .eq("household_id", householdId),
    supabase
      .from("asset_valuations")
      .select("asset_id, value, valued_on")
      .eq("household_id", householdId)
      .order("valued_on", { ascending: false }),
    supabase
      .from("liabilities")
      .select("owner_id, is_joint, current_balance, currency")
      .eq("household_id", householdId),
    supabase
      .from("holdings")
      .select("owner_id, is_joint, quantity, current_price, average_cost, currency")
      .eq("household_id", householdId),
    supabase
      .from("household_preferences")
      .select("default_account_id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", householdId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("household_invitations")
      .select("id, email, created_at")
      .eq("household_id", householdId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const results = [
    ["accounts", accountsResult.error],
    ["transaction_entries", entriesResult.error],
    ["categories", categoriesResult.error],
    ["assets", assetsResult.error],
    ["asset valuations", valuationsResult.error],
    ["liabilities", liabilitiesResult.error],
    ["holdings", holdingsResult.error],
    ["household preferences", preferencesResult.error],
    ["household members", membersResult.error],
    ["household invitations", invitationsResult.error],
  ] as const;
  for (const [stage, error] of results) {
    if (error) reportError(stage, error);
  }

  const accounts = accountsResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const recentTransactions = monthTransactions.filter(
    (transaction) => transaction.kind === "income" ||
      transaction.kind === "expense" ||
      transaction.kind === "transfer",
  );
  const categories = categoriesResult.data ?? [];
  const assets = assetsResult.data ?? [];
  const valuations = valuationsResult.data ?? [];
  const liabilities = liabilitiesResult.data ?? [];
  const holdings = holdingsResult.data ?? [];
  const memberships = membersResult.data ?? [];
  const pendingInvitations = invitationsResult.data ?? [];

  const memberIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase.from("users").select("id, display_name").in("id", memberIds)
    : { data: [], error: null };
  if (profilesError) reportError("household member profiles", profilesError);
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const members: DashboardMember[] = memberships.map((membership) => ({
    userId: membership.user_id,
    displayName: profilesById.get(membership.user_id) || "家庭成員",
    role: membership.role,
  }));

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const accountBalances = new Map(
    accounts.map((account) => [account.id, Number(account.opening_balance) || 0]),
  );
  const monthKinds = new Map(monthTransactions.map((transaction) => [transaction.id, transaction.kind]));
  const monthEntryIds = new Set(monthTransactions.map((transaction) => transaction.id));

  const monthAmounts = new Map<string, number>();
  let monthIncome = 0;
  let monthExpenses = 0;
  for (const entry of entries) {
    accountBalances.set(
      entry.account_id,
      (accountBalances.get(entry.account_id) ?? 0) + Number(entry.amount_delta),
    );
    if (!monthEntryIds.has(entry.transaction_id)) continue;
    const kind = monthKinds.get(entry.transaction_id);
    const amount = Number(entry.amount_delta);
    monthAmounts.set(entry.transaction_id, (monthAmounts.get(entry.transaction_id) ?? 0) + amount);
    if (kind === "income" && amount > 0) monthIncome += amount;
    if (kind === "expense" && amount < 0) monthExpenses += Math.abs(amount);
  }

  let recentSplits: Database["public"]["Tables"]["transaction_splits"]["Row"][] = [];
  if (recentTransactions.length) {
    const { data, error } = await supabase
      .from("transaction_splits")
      .select("*")
      .eq("household_id", householdId)
      .in("transaction_id", recentTransactions.map((transaction) => transaction.id));
    if (error) reportError("recent transaction splits", error);
    recentSplits = data ?? [];
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const splitsByTransaction = new Map<string, typeof recentSplits>();
  for (const split of recentSplits) {
    const bucket = splitsByTransaction.get(split.transaction_id) ?? [];
    bucket.push(split);
    splitsByTransaction.set(split.transaction_id, bucket);
  }
  const entriesByTransaction = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const bucket = entriesByTransaction.get(entry.transaction_id) ?? [];
    bucket.push(entry);
    entriesByTransaction.set(entry.transaction_id, bucket);
  }

  const recentTransactionViews = recentTransactions.map((transaction) => {
    const transactionEntries = entriesByTransaction.get(transaction.id) ?? [];
    const sourceEntry = transactionEntries.find((entry) => Number(entry.amount_delta) < 0);
    const destinationEntry = transactionEntries.find((entry) => Number(entry.amount_delta) > 0);
    const amount = transactionEntries.reduce((sum, entry) => {
      const delta = Number(entry.amount_delta);
      if (transaction.kind === "transfer") return delta < 0 ? sum + Math.abs(delta) : sum;
      return sum + Math.abs(delta);
    }, 0);
    const categoryId = splitsByTransaction.get(transaction.id)?.[0]?.category_id;

    return {
      ...transaction,
      kind: transaction.kind as DashboardTransaction["kind"],
      amount,
      categoryName: categoryId ? categoryNames.get(categoryId) ?? null : null,
      categoryId: categoryId ?? null,
      accountName: sourceEntry
        ? accountNames.get(sourceEntry.account_id) ?? null
        : destinationEntry
          ? accountNames.get(destinationEntry.account_id) ?? null
          : null,
      accountId: sourceEntry?.account_id ?? destinationEntry?.account_id ?? null,
      destinationName:
        transaction.kind === "transfer" && destinationEntry
          ? accountNames.get(destinationEntry.account_id) ?? null
          : null,
      destinationAccountId:
        transaction.kind === "transfer" ? destinationEntry?.account_id ?? null : null,
    };
  });

  const balancesByAccount = accounts.map((account) => ({
    ...account,
    balance: accountBalances.get(account.id) ?? Number(account.opening_balance) ?? 0,
  }));
  const sumAccountBalances = (
    accountRows: typeof balancesByAccount,
    accountTypes: ReadonlySet<string>,
  ) =>
    accountRows
      .filter(
        (account) =>
          account.currency === baseCurrency && accountTypes.has(account.account_type),
      )
      .reduce((sum, account) => sum + account.balance, 0);
  const accountAssets = balancesByAccount
    .filter(
      (account) =>
        account.currency === baseCurrency &&
        cashAccountTypes.has(account.account_type) &&
        !isOtherAssetAccount(account),
    )
    .reduce((sum, account) => sum + account.balance, 0);
  const investmentAccountValue = sumAccountBalances(
    balancesByAccount,
    investmentAccountTypes,
  );
  const otherAssetAccountValue = balancesByAccount
    .filter((account) => account.currency === baseCurrency && isOtherAssetAccount(account))
    .reduce((sum, account) => sum + account.balance, 0);
  const liabilityAccountValue = balancesByAccount
    .filter(
      (account) =>
        account.currency === baseCurrency && liabilityAccountTypes.has(account.account_type),
    )
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);

  const latestValuation = new Map<string, number>();
  for (const valuation of valuations) {
    if (!latestValuation.has(valuation.asset_id)) {
      latestValuation.set(valuation.asset_id, Number(valuation.value));
    }
  }
  const otherAssets =
    otherAssetAccountValue +
    assets
      .filter((asset) => asset.currency === baseCurrency)
      .reduce(
        (sum, asset) =>
          sum + (latestValuation.get(asset.id) ?? Number(asset.purchase_price) ?? 0),
        0,
      );
  const investmentValue =
    investmentAccountValue +
    holdings
      .filter((holding) => holding.currency === baseCurrency)
      .reduce(
        (sum, holding) =>
          sum +
          Number(holding.quantity) *
            Number(holding.current_price ?? holding.average_cost ?? 0),
        0,
      );
  const liabilityValue =
    liabilityAccountValue +
    liabilities
      .filter((liability) => liability.currency === baseCurrency)
      .reduce((sum, liability) => sum + Math.abs(Number(liability.current_balance)), 0);

  const monthTransactionViews: DashboardMonthTransaction[] = monthTransactions.map((transaction) => {
    const amount = Math.abs(monthAmounts.get(transaction.id) ?? 0);
    return {
      id: transaction.id,
      kind: transaction.kind,
      owner_id: transaction.owner_id,
      is_joint: transaction.is_joint,
      amount,
    };
  });

  const totals: DashboardTotals = {
    netWorth: accountAssets + otherAssets + investmentValue - liabilityValue,
    monthIncome,
    monthExpenses,
    monthBalance: monthIncome - monthExpenses,
    accountAssets,
    otherAssets,
    investments: investmentValue,
    liabilities: liabilityValue,
  };

  const memberTotals: Record<string, DashboardTotals> = {};
  for (const member of members) {
    const owns = (item: { owner_id: string | null; is_joint: boolean }) =>
      item.is_joint || item.owner_id === member.userId;
    const memberAccounts = balancesByAccount.filter(owns);
    const memberAccountAssets = memberAccounts
      .filter(
        (account) =>
          account.currency === baseCurrency &&
          cashAccountTypes.has(account.account_type) &&
          !isOtherAssetAccount(account),
      )
      .reduce((sum, account) => sum + account.balance, 0);
    const memberOtherAssets =
      memberAccounts
        .filter(
          (account) => account.currency === baseCurrency && isOtherAssetAccount(account),
        )
        .reduce((sum, account) => sum + account.balance, 0) +
      assets
        .filter((asset) => owns(asset) && asset.currency === baseCurrency)
        .reduce(
          (sum, asset) =>
            sum + (latestValuation.get(asset.id) ?? Number(asset.purchase_price) ?? 0),
          0,
        );
    const memberInvestments =
      sumAccountBalances(memberAccounts, investmentAccountTypes) +
      holdings
        .filter((holding) => owns(holding) && holding.currency === baseCurrency)
        .reduce(
          (sum, holding) =>
            sum +
            Number(holding.quantity) *
              Number(holding.current_price ?? holding.average_cost ?? 0),
          0,
        );
    const memberLiabilityAccountValue = memberAccounts
      .filter(
        (account) =>
          account.currency === baseCurrency && liabilityAccountTypes.has(account.account_type),
      )
      .reduce((sum, account) => sum + Math.abs(account.balance), 0);
    const memberLiabilities =
      memberLiabilityAccountValue +
      liabilities
        .filter((liability) => owns(liability) && liability.currency === baseCurrency)
        .reduce((sum, liability) => sum + Math.abs(Number(liability.current_balance)), 0);
    const memberMonthTransactions = monthTransactionViews.filter(owns);
    const memberMonthIncome = memberMonthTransactions
      .filter((transaction) => transaction.kind === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const memberMonthExpenses = memberMonthTransactions
      .filter((transaction) => transaction.kind === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    memberTotals[member.userId] = {
      netWorth:
        memberAccountAssets + memberOtherAssets + memberInvestments - memberLiabilities,
      monthIncome: memberMonthIncome,
      monthExpenses: memberMonthExpenses,
      monthBalance: memberMonthIncome - memberMonthExpenses,
      accountAssets: memberAccountAssets,
      otherAssets: memberOtherAssets,
      investments: memberInvestments,
      liabilities: memberLiabilities,
    };
  }

  return {
    accounts: balancesByAccount,
    defaultAccountId: preferencesResult.data?.default_account_id ?? null,
    categories,
    members,
    pendingInvitations,
    monthTransactions: monthTransactionViews,
    recentTransactions: recentTransactionViews,
    totals,
    memberTotals,
  };
}