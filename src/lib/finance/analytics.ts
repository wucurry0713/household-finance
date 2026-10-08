import "server-only";

import { loadTransactionReportRows } from "@/lib/finance/transaction-report";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function loadAnalyticsTransactions(
  supabase: SupabaseClient<Database>,
  householdId: string,
) {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
    .toISOString()
    .slice(0, 10);
  try {
    return await loadTransactionReportRows(supabase, householdId, since);
  } catch (error) {
    console.error("[analytics] Failed to load categories or transactions; using empty data", error);
    return [];
  }
}
