import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "../components/AppHeader";
import { MonthSelector } from "../components/MonthSelector";
import AnalyticsWorkspace from "../components/AnalyticsWorkspace";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { month } = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const selectedMonth = month || defaultMonth;

  // 取得使用者家庭 ID 與顯示名稱
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id, display_name")
    .eq("id", user.id)
    .single();

  const userProfile = profile as { household_id?: string; display_name?: string } | null;

  const householdId = userProfile?.household_id || "";
  const displayName =
    userProfile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "家庭成員";

  return (
    <main className="min-h-screen bg-[#FBF9F5] text-[#2C2623]">
      <AppHeader
        currentPage="analytics"
        displayName={displayName}
        month={selectedMonth}
      />
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-12 sm:max-w-6xl">
        <MonthSelector month={selectedMonth} />
        <AnalyticsWorkspace
          householdId={householdId}
          selectedMonth={selectedMonth}
        />
      </div>
    </main>
  );
}