"use client";

import { useActionState, useEffect, useState } from "react";
import { Archive, Banknote, CreditCard, Landmark, Pencil, Plus, Star, X } from "lucide-react";

import {
  createAccountAction,
  deleteAccountAction,
  setDefaultAccountAction,
  updateAccountAction,
  type AccountActionState,
} from "@/app/actions/accounts";
import type { DashboardAccount } from "@/lib/finance/dashboard";

const initialState: AccountActionState = { error: null, success: false };

const accountTypeLabels = {
  cash: "現金",
  bank: "銀行存款",
  credit_card: "信用卡",
  investment: "投資帳戶",
  loan: "貸款帳戶",
};

function AccountIcon({ type }: { type: DashboardAccount["account_type"] }) {
  if (type === "cash") return <Banknote size={18} />;
  if (type === "credit_card") return <CreditCard size={18} />;
  return <Landmark size={18} />;
}

function formatBalance(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("zh-TW")}`;
  }
}

function AccountForm({
  account,
  onClose,
}: {
  account: DashboardAccount | null;
  onClose: () => void;
}) {
  const action = account ? updateAccountAction : createAccountAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [onClose, state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10251e]/45 sm:items-center sm:p-5">
      <section
        aria-labelledby="account-form-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-2xl bg-[#f8faf7] p-5 shadow-2xl sm:rounded-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6b7d73]">家庭帳戶</p>
            <h2 className="mt-1 text-xl font-semibold" id="account-form-title">
              {account ? "編輯帳戶" : "新增帳戶"}
            </h2>
          </div>
          <button
            aria-label="關閉"
            className="grid size-10 place-items-center rounded-full text-[#63756c] hover:bg-[#eaf0eb]"
            onClick={onClose}
            title="關閉"
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          {account && <input name="account_id" type="hidden" value={account.id} />}
          <label className="block">
            <span className="mb-2 block text-sm font-medium">帳戶名稱</span>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
              defaultValue={account?.name ?? ""}
              maxLength={80}
              name="name"
              placeholder="例如：日常現金、中國信託"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">帳戶類型</span>
              <select
                className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457]"
                defaultValue={account?.account_type ?? "cash"}
                name="account_type"
                required
              >
                {Object.entries(accountTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">幣別</span>
              <input
                className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm uppercase outline-none focus:border-[#237457]"
                defaultValue={account?.currency ?? "TWD"}
                maxLength={3}
                minLength={3}
                name="currency"
                pattern="[A-Za-z]{3}"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">期初餘額</span>
            <input
              className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457]"
              defaultValue={account?.opening_balance ?? 0}
              inputMode="decimal"
              name="opening_balance"
              step="0.01"
              type="number"
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-[#dce5de] bg-white px-3 py-3 text-sm">
            <input
              className="size-4 accent-[#237457]"
              defaultChecked={account?.is_shared ?? true}
              name="is_shared"
              type="checkbox"
            />
            <span>設為家庭共同帳戶</span>
          </label>

          {state.error && (
            <p aria-live="polite" className="rounded-lg bg-[#fff0ed] px-3 py-2.5 text-sm text-[#9f3e2e]" role="alert">
              {state.error}
            </p>
          )}

          <button
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#1d6048] text-sm font-semibold text-white transition hover:bg-[#164c39] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "儲存中…" : account ? "儲存變更" : "建立帳戶"}
          </button>
        </form>
      </section>
    </div>
  );
}

function DeleteAccountForm({ accountId }: { accountId: string }) {
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initialState);
  return (
    <form action={formAction}>
      <input name="account_id" type="hidden" value={accountId} />
      {state.error && (
        <p aria-live="polite" className="mt-2 text-xs text-[#9f3e2e]" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="rounded-md p-2 text-[#7a8981] transition hover:bg-[#fff0ed] hover:text-[#9f3e2e] disabled:opacity-50"
        disabled={isPending}
        title="刪除空帳戶"
        type="submit"
      >
        <Archive aria-hidden="true" size={16} />
      </button>
    </form>
  );
}

function SetDefaultAccountForm({
  accountId,
  isDefault,
}: {
  accountId: string;
  isDefault: boolean;
}) {
  const [state, formAction, isPending] = useActionState(setDefaultAccountAction, initialState);
  return (
    <div className="shrink-0">
      <form action={formAction}>
        <input name="account_id" type="hidden" value={accountId} />
        <button
          aria-pressed={isDefault}
          className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:opacity-60 ${
            isDefault
              ? "bg-[#edf5e7] text-[#527342]"
              : "text-[#728178] hover:bg-[#edf2ee] hover:text-[#285943]"
          }`}
          disabled={isPending || isDefault}
          title={isDefault ? "目前預設扣款帳戶" : "設為預設扣款帳戶"}
          type="submit"
        >
          <Star fill={isDefault ? "currentColor" : "none"} size={14} />
          {isDefault ? "預設" : "設為預設"}
        </button>
      </form>
      {state.error && (
        <p aria-live="polite" className="mt-1 max-w-36 text-[11px] text-[#9f3e2e]" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function AccountManager({
  accounts,
  defaultAccountId,
}: {
  accounts: DashboardAccount[];
  defaultAccountId: string | null;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DashboardAccount | null>(null);

  return (
    <section className="border-y border-[#dce5de] bg-white px-5 py-6 sm:px-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">家庭帳戶</h2>
          <p className="mt-1 text-sm text-[#718078]">現金、銀行與信用卡帳戶</p>
        </div>
        <button
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#cddbd1] px-3 text-sm font-semibold text-[#285943] transition hover:bg-[#eff5ef]"
          onClick={() => setIsCreating(true)}
          type="button"
        >
          <Plus size={17} />
          新增帳戶
        </button>
      </div>

      {accounts.length ? (
        <div className="mt-5 divide-y divide-[#edf1ed]">
          {accounts.map((account) => (
            <div className="flex items-center gap-3 py-3.5" key={account.id}>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ec] text-[#237457]">
                <AccountIcon type={account.account_type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <span className="text-xs text-[#829088]">{accountTypeLabels[account.account_type]}</span>
                  {!account.is_shared && <span className="text-xs text-[#829088]">個人</span>}
                </div>
                <p className="mt-1 text-xs text-[#829088]">
                  期初 {formatBalance(account.opening_balance, account.currency)}
                </p>
              </div>
              <p className="whitespace-nowrap text-sm font-semibold text-[#18392f]">
                {formatBalance(account.balance, account.currency)}
              </p>
              <SetDefaultAccountForm
                accountId={account.id}
                isDefault={defaultAccountId === account.id}
              />
              <button
                aria-label={`編輯 ${account.name}`}
                className="rounded-md p-2 text-[#7a8981] transition hover:bg-[#edf2ee] hover:text-[#285943]"
                onClick={() => setEditingAccount(account)}
                title="編輯帳戶"
                type="button"
              >
                <Pencil size={16} />
              </button>
              <DeleteAccountForm accountId={account.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-[#d5dfd8] px-5 py-8 text-center text-sm text-[#77857e]">
          尚未新增帳戶
        </div>
      )}

      {(isCreating || editingAccount) && (
        <AccountForm
          account={editingAccount}
          onClose={() => {
            setIsCreating(false);
            setEditingAccount(null);
          }}
        />
      )}
    </section>
  );
}