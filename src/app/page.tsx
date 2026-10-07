import { Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardWorkspace } from "@/app/components/DashboardWorkspace";
import { signOutAction } from "@/app/login/actions";
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
      <header className="border-b border-[#dce5de] bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link className="flex items-center gap-2.5" href="/">
            <span className="grid size-9 place-items-center rounded-lg bg-[#18392f] text-[#c9ed78]">
              <Wallet size={19} />
            </span>
            <span className="text-sm font-semibold tracking-[0.08em]">TANDEM</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#60736a] sm:inline">{displayName}</span>
            <form action={signOutAction}>
              <button className="rounded-md px-3 py-2 text-sm font-medium text-[#52665d] transition hover:bg-[#edf2ee] hover:text-[#18392f]">
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

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
