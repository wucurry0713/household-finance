import "server-only";
import { loadTransactionReportRows } from "@/lib/finance/transaction-report";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { shiftMonthKey, monthDateRange } from "@/lib/finance/month";

export async function loadAnalyticsTransactions(
  supabase: SupabaseClient<Database>,
  householdId: string,
  selectedMonth: string,
  startDate?: string,
  endDate?: string,
) {
  if (startDate && endDate) {
    return loadTransactionReportRows(supabase, householdId, startDate, endDate);
  } else {
    const since = monthDateRange(shiftMonthKey(selectedMonth, -11)).start;
    const until = monthDateRange(shiftMonthKey(selectedMonth, 1)).start;
    return loadTransactionReportRows(supabase, householdId, since, until);
  }
}