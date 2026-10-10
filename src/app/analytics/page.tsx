import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AnalyticsWorkspace from "@/app/components/AnalyticsWorkspace";
import { AppHeader } from "@/app/components/AppHeader";
import { MonthSelector } from "@/app/components/MonthSelector";
import { loadAnalyticsTransactions } from "@/lib/finance/analytics";
import { getFinanceContext } from "@/lib/finance/context";
import { normalizeMonthKey } from "@/lib/finance/month";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分析統計 | Ledgero",
};

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/analytics">) {
  const params = await searchParams;
  const selectedMonth = normalizeMonthKey(params.month);
  const result = await getFinanceContext();
  if (!result.context) redirect("/login");
  const { supabase, householdId, user } = result.context;

  const [{ data: profile, error: profileError }, { data: household, error: householdError }] =
    await Promise.all([
      supabase.from("users").select("display_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("households")
        .select("base_currency")
        .eq("id", householdId)
        .single(),
    ]);
  if (profileError) {
    console.error("[analytics] profile query failed", profileError);
    throw new Error(`Profile query failed: ${profileError.message}`);
  }
  if (householdError) {
    console.error("[analytics] household query failed", householdError);
    throw new Error(`Household query failed: ${householdError.message}`);
  }
  const transactions = await loadAnalyticsTransactions(supabase, householdId, selectedMonth);
  const displayName =
    profile?.display_name ||
    user.user_metadata.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  return (
    <main className="min-h-screen bg-[#FBF9F5] text-[#2C2623]">
      <AppHeader currentPage="analytics" displayName={displayName} month={selectedMonth} />
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl sm:px-8 sm:py-14">
        <MonthSelector month={selectedMonth} />
{/* 正確的寫法 */}
<AnalyticsWorkspace
  householdId={householdId}
/>
      </div>
    </main>
  );
}
