"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, House, UserRound, Wallet } from "lucide-react";

import { AccountManager } from "@/app/components/AccountManager";
import { HouseholdMembersPanel } from "@/app/components/HouseholdMembersPanel";
import { QuickTransactionModal } from "@/app/components/QuickTransactionModal";
import { RecentTransactions } from "@/app/components/RecentTransactions";
import type { DashboardData } from "@/lib/finance/dashboard";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("zh-TW")}`;
  }
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="border-l-2 border-[#b6d98c] bg-white px-5 py-5">
      <div className="flex items-center gap-2 text-[#557167]">
        {icon}
        <h2 className="text-sm font-medium">{label}</h2>
      </div>
      <p className="mt-5 text-lg font-semibold text-[#60736a]">{value}</p>
    </article>
  );
}

function AssetLine({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#687a70]">{label}</span>
      <span className={value < 0 ? "font-medium text-[#a05b48]" : "font-medium text-[#263c32]"}>
        {formatMoney(value, currency)}
      </span>
    </div>
  );
}

function CashFlowLine({
  label,
  amount,
  max,
  currency,
  tone,
}: {
  label: string;
  amount: number;
  max: number;
  currency: string;
  tone: "income" | "expense";
}) {
  const width = max > 0 ? Math.max(4, (amount / max) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-[#687a70]">{label}</span>
        <span className="font-medium text-[#263c32]">{formatMoney(amount, currency)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#edf1ed]">
        <div
          className={`h-full rounded-full ${tone === "income" ? "bg-[#6eaa7c]" : "bg-[#d99a72]"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardWorkspace({
  currentUserId,
  dashboard,
  displayName,
  householdName,
  baseCurrency,
}: {
  currentUserId: string;
  dashboard: DashboardData;
  displayName: string;
  householdName: string;
  baseCurrency: string;
}) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const activeMember = selectedOwnerId
    ? dashboard.members.find((member) => member.userId === selectedOwnerId)
    : null;
  const totals = activeMember
    ? dashboard.memberTotals[activeMember.userId] ?? dashboard.totals
    : dashboard.totals;
  const visibleAccounts = selectedOwnerId
    ? dashboard.accounts.filter(
        (account) => account.is_joint || account.owner_id === selectedOwnerId,
      )
    : dashboard.accounts;
  const visibleTransactions = selectedOwnerId
    ? dashboard.recentTransactions.filter(
        (transaction) => transaction.is_joint || transaction.owner_id === selectedOwnerId,
      )
    : dashboard.recentTransactions;
  const maxCashFlow = Math.max(totals.monthIncome, totals.monthExpenses);

  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#557167]">家庭總覽</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
            {activeMember ? `${activeMember.displayName} 的視角` : householdName}
          </h1>
        </div>
        <div className="text-sm text-[#66776f]">
          歡迎回來，<span className="font-medium text-[#18392f]">{displayName}</span>
        </div>
      </div>

      <div
        aria-label="切換 Dashboard 視角"
        className="mt-7 flex w-full gap-1 overflow-x-auto rounded-lg bg-[#e9efea] p-1 sm:w-fit"
        role="group"
      >
        <button
          aria-pressed={selectedOwnerId === null}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
            selectedOwnerId === null
              ? "bg-white text-[#1d6048] shadow-sm"
              : "text-[#687a70] hover:text-[#18392f]"
          }`}
          onClick={() => setSelectedOwnerId(null)}
          type="button"
        >
          <House size={16} />
          家庭總覽
        </button>
        {dashboard.members.map((member) => (
          <button
            aria-pressed={selectedOwnerId === member.userId}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              selectedOwnerId === member.userId
                ? "bg-white text-[#1d6048] shadow-sm"
                : "text-[#687a70] hover:text-[#18392f]"
            }`}
            key={member.userId}
            onClick={() => setSelectedOwnerId(member.userId)}
            type="button"
          >
            <UserRound size={16} />
            {member.displayName}
            {member.userId === currentUserId ? "（我）" : "（另一半）"}
          </button>
        ))}
      </div>

      <section aria-label="家庭財務摘要" className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryItem
          icon={<Wallet size={18} />}
          label="家庭淨資產"
          value={formatMoney(totals.netWorth, baseCurrency)}
        />
        <SummaryItem
          icon={<ArrowDownLeft size={18} />}
          label="本月收入"
          value={formatMoney(totals.monthIncome, baseCurrency)}
        />
        <SummaryItem
          icon={<ArrowUpRight size={18} />}
          label="本月支出"
          value={formatMoney(totals.monthExpenses, baseCurrency)}
        />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-8">
          <AccountManager
            accounts={visibleAccounts}
            defaultAccountId={dashboard.defaultAccountId}
          />
          <RecentTransactions
            accounts={dashboard.accounts}
            categories={dashboard.categories}
            transactions={visibleTransactions}
            viewOwnerId={selectedOwnerId}
          />
        </div>

        <aside className="space-y-8">
          <section className="border-y border-[#dce5de] bg-white px-5 py-6 sm:px-7">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ec] text-[#237457]">
                <Wallet size={19} />
              </span>
              <div>
                <h2 className="font-semibold">資產配置</h2>
                <p className="mt-1 text-xs text-[#829088]">以 {baseCurrency} 計</p>
              </div>
            </div>
            <div className="mt-6 space-y-5">
              <AssetLine label="帳戶餘額" value={totals.accountAssets} currency={baseCurrency} />
              <AssetLine label="其他資產" value={totals.otherAssets} currency={baseCurrency} />
              <AssetLine label="投資部位" value={totals.investments} currency={baseCurrency} />
              <AssetLine label="負債" value={-totals.liabilities} currency={baseCurrency} />
            </div>
          </section>

          <section className="border-y border-[#dce5de] bg-white px-5 py-6 sm:px-7">
            <div>
              <h2 className="font-semibold">本月現金流</h2>
              <p className="mt-1 text-xs text-[#829088]">收入與支出比較</p>
            </div>
            <div className="mt-6 space-y-5">
              <CashFlowLine
                label="收入"
                amount={totals.monthIncome}
                max={maxCashFlow}
                currency={baseCurrency}
                tone="income"
              />
              <CashFlowLine
                label="支出"
                amount={totals.monthExpenses}
                max={maxCashFlow}
                currency={baseCurrency}
                tone="expense"
              />
            </div>
          </section>

          <HouseholdMembersPanel
            currentUserId={currentUserId}
            members={dashboard.members}
            pendingInvitations={dashboard.pendingInvitations}
          />
        </aside>
      </div>

      <QuickTransactionModal
        accounts={visibleAccounts}
        categories={dashboard.categories}
        defaultAccountId={dashboard.defaultAccountId}
      />
    </>
  );
}