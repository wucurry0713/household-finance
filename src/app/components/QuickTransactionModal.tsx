"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  Bus,
  Coffee,
  Film,
  HeartPulse,
  House,
  Plus,
  ShoppingBasket,
  Utensils,
  Wallet,
  X,
} from "lucide-react";

import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import { defaultCategoryOptions } from "@/lib/finance/default-categories";
import type { DashboardAccount } from "@/lib/finance/dashboard";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type TransactionKind = "expense" | "income" | "transfer";

export type EditableTransaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  transaction_date: string;
  notes: string | null;
  categoryId: string | null;
  accountId: string | null;
  destinationAccountId: string | null;
};

const initialState: TransactionActionState = {
  error: null,
  success: false,
  intent: null,
};

const transactionKinds: { kind: TransactionKind; label: string; icon: typeof ArrowDownLeft }[] = [
  { kind: "expense", label: "支出", icon: ArrowUpRight },
  { kind: "income", label: "收入", icon: ArrowDownLeft },
  { kind: "transfer", label: "轉帳", icon: ArrowLeftRight },
];

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCategoryIcon(name: string) {
  if (/餐|飲食|咖啡/.test(name)) return Utensils;
  if (/超商|便利/.test(name)) return Coffee;
  if (/交通|通勤/.test(name)) return Bus;
  if (/娛樂|休閒/.test(name)) return Film;
  if (/日用|購物|生活/.test(name)) return ShoppingBasket;
  if (/醫療|保險|健康/.test(name)) return HeartPulse;
  if (/居家|房租|住房/.test(name)) return House;
  return Wallet;
}

export function QuickTransactionModal({
  accounts,
  categories,
  defaultAccountId,
  initialTransaction,
  onClose,
}: {
  accounts: DashboardAccount[];
  categories: Category[];
  defaultAccountId?: string | null;
  initialTransaction?: EditableTransaction | null;
  onClose?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(initialTransaction));
  const [kind, setKind] = useState<TransactionKind>(initialTransaction?.kind ?? "expense");
  const [amount, setAmount] = useState(initialTransaction ? String(initialTransaction.amount) : "");
  const [accountId, setAccountId] = useState(initialTransaction?.accountId ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    initialTransaction?.destinationAccountId ?? "",
  );
  const [categoryId, setCategoryId] = useState(initialTransaction?.categoryId ?? "");
  const [fallbackCategory, setFallbackCategory] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(
    initialTransaction?.kind === "transfer",
  );
  const [date, setDate] = useState(initialTransaction?.transaction_date ?? getToday());
  const [notes, setNotes] = useState(initialTransaction?.notes ?? "");
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const action = initialTransaction ? updateTransactionAction : createTransactionAction;
  const visibleCategories =
    kind === "transfer" ? [] : categories.filter((category) => category.kind === kind);
  const rootCategories = visibleCategories.filter(
    (category) => !category.parent_category_id,
  );
  const categoryOptions = rootCategories.flatMap((parent) => {
    const children = visibleCategories.filter(
      (category) => category.parent_category_id === parent.id,
    );
    return children.length ? children : [parent];
  });
  const fallbackCategoryOptions =
    kind === "transfer"
      ? []
      : defaultCategoryOptions[kind].filter(
          (name) => !visibleCategories.some((category) => category.name === name),
        );
  const availableAccounts = accounts.filter((account) => !account.is_archived);
  const suggestedAccount =
    availableAccounts.find((account) => account.id === defaultAccountId) ??
    availableAccounts.find((account) => account.account_type === "cash" && account.is_shared) ??
    availableAccounts.find(
      (account) => account.is_shared && /日常|現金流|生活支出/.test(account.name),
    ) ??
    availableAccounts.find((account) => account.is_shared) ??
    availableAccounts[0];
  const effectiveAccountId =
    accountId || initialTransaction?.accountId || suggestedAccount?.id || "";
  const selectedAccount = availableAccounts.find((account) => account.id === effectiveAccountId);
  const destinationAccounts = availableAccounts.filter(
    (account) =>
      account.id !== effectiveAccountId &&
      (!selectedAccount || account.currency === selectedAccount.currency),
  );

  function closeModal() {
    if (isPending) return;
    setIsOpen(false);
    onClose?.();
  }

  function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement ? submitter.value : "close";
    formData.set("intent", intent);
    formData.set("fallback_category", fallbackCategory);

    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (!result.success) return;

      if (result.intent === "continue" && !initialTransaction) {
        form.reset();
        setAmount("");
        setCategoryId("");
        setFallbackCategory("");
        setNotes("");
        const today = getToday();
        setDate(today);
        return;
      }

      closeModal();
    });
  }

  function openModal() {
    if (!initialTransaction) setIsOpen(true);
  }

  return (
    <>
      {!initialTransaction && (
        <button
          aria-label="快速記帳"
          className="fixed bottom-6 right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#1d6048] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(24,57,47,0.24)] transition hover:-translate-y-0.5 hover:bg-[#164c39] sm:bottom-8 sm:right-8"
          onClick={openModal}
          title="快速記帳"
          type="button"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>記一筆</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#10251e]/45 sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            aria-labelledby="quick-transaction-title"
            aria-modal="true"
            className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[#f8faf7] px-5 pb-6 pt-4 shadow-2xl sm:rounded-2xl sm:px-7 sm:pb-7"
            role="dialog"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d5dfd8] sm:hidden" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#6b7d73]">家庭帳本</p>
                <h2 id="quick-transaction-title" className="mt-1 text-xl font-semibold">
                  {initialTransaction ? "編輯交易" : "快速記帳"}
                </h2>
              </div>
              <button
                aria-label="關閉"
                className="grid size-10 place-items-center rounded-full text-[#63756c] hover:bg-[#eaf0eb]"
                onClick={closeModal}
                title="關閉"
                type="button"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 rounded-lg bg-[#eaf0eb] p-1">
              {transactionKinds.map(({ kind: option, label, icon: Icon }) => (
                <button
                  aria-pressed={kind === option}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition ${
                    kind === option
                      ? "bg-white text-[#1d6048] shadow-sm"
                      : "text-[#65766d] hover:text-[#18392f]"
                  }`}
                  key={option}
                  onClick={() => {
                    setKind(option);
                    setCategoryId("");
                    setFallbackCategory("");
                    setShowMoreOptions(option === "transfer");
                  }}
                  type="button"
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-5" onSubmit={submitTransaction}>
              {initialTransaction && (
                <input name="transaction_id" type="hidden" value={initialTransaction.id} />
              )}
              <input name="kind" type="hidden" value={kind} />
              <input name="category_id" type="hidden" value={categoryId} />

              <label className="block rounded-xl border border-[#dce5de] bg-white px-4 py-3">
                <span className="text-xs font-medium text-[#728178]">
                  金額 · {selectedAccount?.currency ?? accounts[0]?.currency ?? "TWD"}
                </span>
                <span className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-[#789087]">$</span>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight text-[#18392f] outline-none placeholder:text-[#bdc8c0] focus:ring-0"
                    inputMode="decimal"
                    max="1000000000000"
                    min="0.01"
                    name="amount"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                    required
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                </span>
              </label>

              {kind !== "transfer" ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">分類</p>
                    <span className="text-xs text-[#78877f]">可略過</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {categoryOptions.map((category) => {
                      const Icon = getCategoryIcon(category.name);
                      const selected = categoryId === category.id;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition ${
                            selected
                              ? "border-[#4e8d6e] bg-[#eaf4ed] text-[#1d6048]"
                              : "border-[#e0e7e1] bg-white text-[#66776e] hover:border-[#afc8b6]"
                          }`}
                          key={category.id}
                          onClick={() => {
                            setCategoryId(selected ? "" : category.id);
                            setFallbackCategory("");
                          }}
                          type="button"
                        >
                          <Icon size={17} />
                          <span className="max-w-full truncate">{category.name}</span>
                        </button>
                      );
                    })}
                    {fallbackCategoryOptions.map((name) => {
                      const Icon = getCategoryIcon(name);
                      const selected = fallbackCategory === name;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition ${
                            selected
                              ? "border-[#4e8d6e] bg-[#eaf4ed] text-[#1d6048]"
                              : "border-[#e0e7e1] bg-white text-[#66776e] hover:border-[#afc8b6]"
                          }`}
                          key={`fallback-${name}`}
                          onClick={() => {
                            setCategoryId("");
                            setFallbackCategory(selected ? "" : name);
                          }}
                          type="button"
                        >
                          <Icon size={17} />
                          <span className="max-w-full truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {fallbackCategoryOptions.length > 0 && (
                    <p className="mt-2 text-xs text-[#78877f]">儲存時會自動加入家庭分類。</p>
                  )}
                </div>
              ) : null}

              <div className="border-t border-[#e2e9e3] pt-3">
                <button
                  aria-expanded={showMoreOptions}
                  className="text-sm font-medium text-[#557167] underline decoration-[#bdcdc0] underline-offset-4 hover:text-[#1d6048]"
                  onClick={() => setShowMoreOptions((shown) => !shown)}
                  type="button"
                >
                  {showMoreOptions ? "收合選項" : "更多選項"}
                </button>

                {showMoreOptions ? (
                  <div className={`mt-4 grid gap-3 ${kind === "transfer" ? "sm:grid-cols-2" : ""}`}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium">
                        {kind === "income" ? "入帳帳戶" : kind === "transfer" ? "轉出帳戶" : "扣款帳戶"}
                      </span>
                      <select
                        className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                        name="account_id"
                        onChange={(event) => setAccountId(event.target.value)}
                        required
                        value={effectiveAccountId}
                      >
                        <option value="">選擇帳戶</option>
                        {availableAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </label>

                    {kind === "transfer" && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">轉入帳戶</span>
                    <select
                      className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                      name="destination_account_id"
                      onChange={(event) => setDestinationAccountId(event.target.value)}
                      required
                      value={destinationAccountId}
                    >
                      <option value="">選擇帳戶</option>
                      {destinationAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {account.currency}
                        </option>
                      ))}
                    </select>
                  </label>
                    )}
                  </div>
                ) : (
                  <>
                    <input name="account_id" type="hidden" value={effectiveAccountId} />
                    {kind === "transfer" && (
                      <input
                        name="destination_account_id"
                        type="hidden"
                        value={destinationAccountId}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">日期</span>
                  <input
                    className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                    name="transaction_date"
                    onChange={(event) => setDate(event.target.value)}
                    required
                    type="date"
                    value={date}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">備註</span>
                  <input
                    className="h-11 w-full rounded-lg border border-[#d6dfd9] bg-white px-3 text-sm outline-none placeholder:text-[#a0ada5] focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                    maxLength={200}
                    name="notes"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="例如：週末採買"
                    value={notes}
                  />
                </label>
              </div>

              {state.error && (
                <p aria-live="polite" className="rounded-lg bg-[#fff0ed] px-3 py-2.5 text-sm text-[#9f3e2e]" role="alert">
                  {state.error}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {!initialTransaction && (
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cddbd1] bg-white text-sm font-semibold text-[#285943] transition hover:bg-[#eff5ef] disabled:opacity-60"
                    disabled={isPending}
                    name="intent"
                    type="submit"
                    value="continue"
                  >
                    {isPending ? "儲存中…" : "新增後繼續"}
                  </button>
                )}
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1d6048] text-sm font-semibold text-white transition hover:bg-[#164c39] disabled:opacity-60"
                  disabled={isPending}
                  name="intent"
                  type="submit"
                  value="close"
                >
                  {isPending ? "儲存中…" : initialTransaction ? "儲存變更" : "儲存並關閉"}
                  {!isPending && <ArrowRight size={16} />}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}