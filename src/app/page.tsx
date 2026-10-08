import { redirect } from "next/navigation";

import { AppHeader } from "@/app/components/AppHeader";
import { DashboardWorkspace } from "@/app/components/DashboardWorkspace";
import { MonthSelector } from "@/app/components/MonthSelector";
import { loadDashboardData } from "@/lib/finance/dashboard";
import { normalizeMonthKey } from "@/lib/finance/month";
import { ensureUserProfileAndHousehold } from "@/lib/supabase/provision";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: PageProps<"/">) {
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
      .select("name, base_currency")
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
    user.user_metadata.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  return (
    <main className="min-h-screen bg-[#FBF9F5] text-[#2C2623]">
      <AppHeader currentPage="dashboard" displayName={displayName} month={selectedMonth} />

      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl sm:px-8 sm:py-14">
        <MonthSelector month={selectedMonth} />
        <DashboardWorkspace
          currentUserId={user.id}
          dashboard={dashboard}
          displayName={displayName}
          householdName={household?.name ?? "我的家庭"}
          baseCurrency={baseCurrency}
          selectedMonth={selectedMonth}
        />
      </div>
    </main>
  );
}
