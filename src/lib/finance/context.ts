import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type FinanceContext = {
  supabase: SupabaseClient<Database>;
  user: User;
  householdId: string;
};

export async function getFinanceContext(): Promise<
  | { context: FinanceContext; error: null }
  | { context: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { context: null, error: "登入狀態已失效，請重新登入。" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[finance] Failed to load active household", {
      userId: user.id,
      code: membershipError.code,
      message: membershipError.message,
      details: membershipError.details,
      hint: membershipError.hint,
    });
    return { context: null, error: membershipError.message };
  }

  if (!membership) {
    return { context: null, error: "找不到有效的家庭空間，請重新登入。" };
  }

  return {
    context: { supabase, user, householdId: membership.household_id },
    error: null,
  };
}