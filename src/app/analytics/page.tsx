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

  const resolvedParams = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const selectedMonth = resolvedParams.month || defaultMonth;

  // 1. 取得使用者 profile 資訊
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

  // 2. 設定月份起訖時間
  const startDate = `${selectedMonth}-01`;
  const [year, m] = selectedMonth.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${selectedMonth}-${lastDay}`;

  // 3. 查詢交易資料
  let transactions: any[] = [];
  
  if (householdId) {
    const { data: householdData } = await supabase
      .from("transactions")
      .select("*")
      .eq("household_id", householdId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (householdData && householdData.length > 0) {
      transactions = householdData;
    }
  }

  if (transactions.length === 0) {
    const { data: userData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    if (userData && userData.length > 0) {
      transactions = userData;
    }
  }

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
          initialTransactions={transactions}
        />
      </div>
    </main>
  );
}