import "server-only";

import { loadTransactionReportRows } from "@/lib/finance/transaction-report";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { shiftMonthKey, monthDateRange } from "@/lib/finance/month";

export async function loadAnalyticsTransactions(
  supabase: SupabaseClient<Database>,
  householdId: string,
  selectedMonth: string,
) {
  const since = monthDateRange(shiftMonthKey(selectedMonth, -11)).start;
  const until = monthDateRange(selectedMonth).end;
  try {
    return await loadTransactionReportRows(supabase, householdId, since, until);
  } catch (error) {
    console.error("[analytics] Failed to load categories or transactions; using empty data", error);
    return [];
  }
}
