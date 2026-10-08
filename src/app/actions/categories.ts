"use server";

import { revalidatePath } from "next/cache";

import { getFinanceContext } from "@/lib/finance/context";

const customExpenseIcons = new Set([
  "utensils",
  "bus",
  "house",
  "shopping",
  "health",
  "wallet",
]);

export async function createCustomExpenseCategory(input: {
  name: string;
  icon: string;
}) {
  const name = input.name.trim();
  if (!name || name.length > 40) {
    return { category: null, error: "分類名稱需為 1 至 40 個字。" };
  }
  if (!customExpenseIcons.has(input.icon)) {
    return { category: null, error: "請選擇有效的分類圖示。" };
  }

  const result = await getFinanceContext();
  if (!result.context) return { category: null, error: result.error };
  const { supabase, householdId } = result.context;

  const { data: existing, error: findError } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .eq("kind", "expense")
    .eq("name", name)
    .maybeSingle();
  if (findError) {
    console.error("[categories] Custom category lookup failed", findError);
    return { category: null, error: `查詢分類失敗：${findError.message}` };
  }
  if (existing) {
    return { category: existing, error: null };
  }

  const { data: category, error } = await supabase
    .from("categories")
    .insert({
      household_id: householdId,
      name,
      kind: "expense",
      icon: input.icon,
      is_system: false,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[categories] Custom category creation failed", error);
    return { category: null, error: `新增分類失敗：${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/analytics");
  return { category, error: null };
}
