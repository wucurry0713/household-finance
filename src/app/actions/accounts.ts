"use server";

import { revalidatePath } from "next/cache";

import { getFinanceContext } from "@/lib/finance/context";
import { isAccountType, type AccountType } from "@/lib/finance/account-types";

export type AccountActionState = {
  error: string | null;
  success: boolean;
};

const failed = (error: string): AccountActionState => ({ error, success: false });

function getAccountType(value: FormDataEntryValue | null): AccountType | null {
  return isAccountType(value) ? value : null;
}

function getAccountFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const accountType = getAccountType(formData.get("account_type"));
  const currency = String(formData.get("currency") ?? "TWD").trim().toUpperCase();
  const openingBalance = Number(formData.get("opening_balance") ?? 0);
  const isShared = formData.get("is_shared") === "on";

  if (!name || name.length > 80) return { error: "帳戶名稱需為 1 至 80 個字。" };
  if (!accountType) return { error: "請選擇有效的帳戶類型。" };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "請輸入 3 碼幣別，例如 TWD。" };
  if (!Number.isFinite(openingBalance)) return { error: "期初餘額格式不正確。" };

  return { name, accountType, currency, openingBalance, isShared };
}

export async function createAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const fields = getAccountFields(formData);
  if ("error" in fields) return failed(fields.error ?? "帳戶資料不完整。");

  const result = await getFinanceContext();
  if (!result.context) return failed(result.error);

  const { supabase, user, householdId } = result.context;
  const { error } = await supabase.from("accounts").insert({
    household_id: householdId,
    owner_user_id: fields.isShared ? null : user.id,
    owner_id: fields.isShared ? null : user.id,
    is_joint: fields.isShared,
    name: fields.name,
    account_type: fields.accountType,
    currency: fields.currency,
    opening_balance: fields.openingBalance,
    is_shared: fields.isShared,
  });

  if (error) {
    console.error("[accounts] Create failed", error);
    return failed(error.message);
  }

  revalidatePath("/");
  return { error: null, success: true };
}

export async function updateAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = String(formData.get("account_id") ?? "");
  const fields = getAccountFields(formData);
  if (!accountId) return failed("缺少帳戶 ID。");
  if ("error" in fields) return failed(fields.error ?? "帳戶資料不完整。");

  const result = await getFinanceContext();
  if (!result.context) return failed(result.error);

  const { supabase, user, householdId } = result.context;
  const { error } = await supabase
    .from("accounts")
    .update({
      owner_user_id: fields.isShared ? null : user.id,
      owner_id: fields.isShared ? null : user.id,
      is_joint: fields.isShared,
      name: fields.name,
      account_type: fields.accountType,
      currency: fields.currency,
      opening_balance: fields.openingBalance,
      is_shared: fields.isShared,
    })
    .eq("id", accountId)
    .eq("household_id", householdId);

  if (error) {
    console.error("[accounts] Update failed", { accountId, ...error });
    return failed(error.message);
  }

  revalidatePath("/");
  return { error: null, success: true };
}

export async function deleteAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) return failed("缺少帳戶 ID。");

  const result = await getFinanceContext();
  if (!result.context) return failed(result.error);

  const { supabase, householdId } = result.context;
  const { data: entries, error: entriesError } = await supabase
    .from("transaction_entries")
    .select("id")
    .eq("account_id", accountId)
    .eq("household_id", householdId)
    .limit(1);

  if (entriesError) {
    console.error("[accounts] Delete preflight failed", { accountId, ...entriesError });
    return failed(entriesError.message);
  }
  if (entries.length) {
    return failed("此帳戶已有交易紀錄，為保留帳務資料，請改為封存帳戶。");
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("household_id", householdId);

  if (error) {
    console.error("[accounts] Delete failed", { accountId, ...error });
    return failed(error.message);
  }

  revalidatePath("/");
  return { error: null, success: true };
}

export async function setDefaultAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) return failed("缺少帳戶 ID。");

  const result = await getFinanceContext();
  if (!result.context) return failed(result.error);

  const { supabase, user, householdId } = result.context;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, is_archived")
    .eq("id", accountId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (accountError) {
    console.error("[accounts] Default account validation failed", accountError);
    return failed(accountError.message);
  }
  if (!account || account.is_archived) return failed("找不到可用的家庭帳戶。");

  const { error } = await supabase.from("household_preferences").upsert(
    {
      household_id: householdId,
      user_id: user.id,
      default_account_id: accountId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,user_id" },
  );

  if (error) {
    console.error("[accounts] Setting default account failed", error);
    return failed(error.message);
  }

  revalidatePath("/");
  return { error: null, success: true };
}