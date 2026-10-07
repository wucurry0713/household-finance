import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsWorkspace } from "@/app/components/AnalyticsWorkspace";
import { AppHeader } from "@/app/components/AppHeader";
import { loadAnalyticsTransactions } from "@/lib/finance/analytics";
import { getFinanceContext } from "@/lib/finance/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分析統計 | Tandem",
};

export default async function AnalyticsPage() {
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
  const transactions = await loadAnalyticsTransactions(supabase, householdId);
  const displayName =
    profile?.display_name ||
    user.user_metadata.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  return (
    <main className="min-h-screen bg-[#f4f7f3] text-[#14251f]">
      <AppHeader currentPage="analytics" displayName={displayName} />
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl sm:px-8 sm:py-14">
        <AnalyticsWorkspace
          currency={household.base_currency}
          transactions={transactions}
        />
      </div>
    </main>
  );
}
