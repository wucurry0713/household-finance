import { redirect } from "next/navigation";

import { AppHeader } from "@/app/components/AppHeader";
import { DashboardWorkspace } from "@/app/components/DashboardWorkspace";
import { loadDashboardData } from "@/lib/finance/dashboard";
import { ensureUserProfileAndHousehold } from "@/lib/supabase/provision";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
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
  );

  const displayName =
    profile?.display_name ||
    user.user_metadata.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  return (
    <main className="min-h-screen bg-[#f4f7f3] text-[#14251f]">
      <AppHeader currentPage="dashboard" displayName={displayName} />

      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl sm:px-8 sm:py-14">
        <DashboardWorkspace
          currentUserId={user.id}
          dashboard={dashboard}
          displayName={displayName}
          householdName={household?.name ?? "我的家庭"}
          baseCurrency={baseCurrency}
        />
      </div>
    </main>
  );
}
