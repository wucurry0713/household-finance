import { redirect } from "next/navigation";

import { AppHeader } from "@/app/components/AppHeader";
import AnalyticsWorkspace from "@/app/components/AnalyticsWorkspace";
import { loadDashboardData } from "@/lib/finance/dashboard";
import { normalizeMonthKey } from "@/lib/finance/month";
import { ensureUserProfileAndHousehold } from "@/lib/supabase/provision";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const selectedMonth = normalizeMonthKey(params.month);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const provision = await ensureUserProfileAndHousehold(supabase, user);
  if (provision.error !== null) throw new Error(provision.error);

  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("households")
      .select("base_currency")
      .eq("id", provision.householdId)
      .single(),
  ]);
  const baseCurrency = household?.base_currency ?? "TWD";

  const dashboard = await loadDashboardData(
    supabase,
    provision.householdId,
    user.id,
    baseCurrency,
    selectedMonth,
  );

  const displayName =
    profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  const transactions = dashboard.recentTransactions || [];

  // 🔍 完整印出每一筆交易的所有屬性到終端機，找出雙人標籤的真正欄位
  console.log("=== 當前登入的使用者 ID ===", user.id);
  transactions.forEach((t: any, index: number) => {
    console.log(`[交易 #${index + 1}]`, JSON.stringify(t, null, 2));
  });

  return (
    <main className="min-h-screen bg-[#FBF9F5] text-[#2C2623]">
      <AppHeader currentPage="analytics" displayName={displayName} month={selectedMonth} />

      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl sm:px-8 sm:py-14">
        <AnalyticsWorkspace
          householdId={provision.householdId}
          currentUserId={user.id}
          selectedMonth={selectedMonth}
          initialTransactions={transactions}
        />
      </div>
    </main>
  );
}