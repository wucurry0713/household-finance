"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Bus,
  Coffee,
  Flame,
  Film,
  Gift,
  HeartPulse,
  HeartHandshake,
  HandCoins,
  House,
  Package,
  Plus,
  ShoppingBasket,
  Target,
  Utensils,
  UserRound,
  Wallet,
  Droplets,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";

import { createCustomCategory } from "@/app/actions/categories";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import { defaultCategoryOptions } from "@/lib/finance/default-categories";
import {
  expenseScopeLabels,
  expenseScopes,
  isExpenseScope,
  type ExpenseScope,
  type StoredExpenseScope,
} from "@/lib/finance/expense-scope";
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
  scope: StoredExpenseScope;
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

const EXPENSE_ORDER = [
  "早餐",
  "午餐",
  "晚餐",
  "交通",
  "其他",
  "家人",
  "出國旅費",
  "房貸",
  "社交",
  "電話費",
  "保險",
  "治裝費",
  "日用品",
  "醫療",
  "稅務",
  "水費 💧",
  "電費 ⚡",
  "天然氣費 🔥",
  "管理費 🏢",
];

const INCOME_ORDER = [
  "薪水",
  "股息",
  "油資補貼",
  "股票贖回",
  "中獎 / 發票 🎯",
  "紅包 / 禮金 🧧",
  "二手售出 📦",
  "其他收入 💰",
];

const customCategoryIcons: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "wallet", label: "帳務", icon: Wallet },
  { key: "utensils", label: "餐飲", icon: Utensils },
  { key: "bus", label: "交通", icon: Bus },
  { key: "house", label: "居家", icon: House },
  { key: "shopping", label: "購物", icon: ShoppingBasket },
  { key: "health", label: "健康", icon: HeartPulse },
];

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCategoryIcon(name: string, icon?: string | null) {
  const customIcon = customCategoryIcons.find((item) => item.key === icon)?.icon;
  if (customIcon) return customIcon;
  if (/中獎|發票/.test(name)) return Target;
  if (/紅包|禮金/.test(name)) return Gift;
  if (/二手售出/.test(name)) return Package;
  if (/其他收入/.test(name)) return BadgeDollarSign;
  if (/水費/.test(name)) return Droplets;
  if (/電費/.test(name)) return Zap;
  if (/天然氣/.test(name)) return Flame;
  if (/管理費/.test(name)) return Building2;
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
  const router = useRouter();
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
  const [scope, setScope] = useState<ExpenseScope>(
    initialTransaction && isExpenseScope(initialTransaction.scope)
      ? initialTransaction.scope
      : "personal",
  );
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customCategoryIcon, setCustomCategoryIcon] = useState("wallet");
  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);
  const [isSavingCustomCategory, setIsSavingCustomCategory] = useState(false);
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
  const categoryOrder =
    kind === "expense" ? EXPENSE_ORDER : kind === "income" ? INCOME_ORDER : [];
  const displayCategories: {
    category: Category | null;
    fallbackName: string | null;
  }[] = [
    ...categoryOptions
      .map((category) => ({ category, fallbackName: null })),
    ...fallbackCategoryOptions
      .map((name) => ({ category: null, fallbackName: name })),
  ].sort((a, b) => {
    const aName = a.category?.name ?? a.fallbackName ?? "";
    const bName = b.category?.name ?? b.fallbackName ?? "";
    const aIndex = categoryOrder.indexOf(aName);
    const bIndex = categoryOrder.indexOf(bName);
    const aOrder = aIndex === -1 ? categoryOrder.length : aIndex;
    const bOrder = bIndex === -1 ? categoryOrder.length : bIndex;
    return aOrder - bOrder;
  });
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

  function resetForm() {
    setKind("expense");
    setAmount("");
    setAccountId("");
    setDestinationAccountId("");
    setCategoryId("");
    setFallbackCategory("");
    setShowMoreOptions(false);
    setDate(getToday());
    setNotes("");
    setScope("personal");
    setState(initialState);
    setShowCustomCategory(false);
    setCustomCategoryName("");
    setCustomCategoryIcon("wallet");
    setCustomCategoryError(null);
  }

  function closeModal() {
    if (isPending) return;
    if (!initialTransaction) resetForm();
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
        resetForm();
        return;
      }

      closeModal();
    });
  }

  function openModal() {
    if (!initialTransaction) {
      resetForm();
      setIsOpen(true);
    }
  }

  async function saveCustomCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCustomCategory(true);
    setCustomCategoryError(null);
    try {
      const result = await createCustomCategory({
        name: customCategoryName,
        icon: customCategoryIcon,
        kind: kind === "income" ? "income" : "expense",
      });
      if (result.error || !result.category) {
        setCustomCategoryError(result.error ?? "新增分類失敗。");
        return;
      }
      setCategoryId(result.category.id);
      setFallbackCategory("");
      setCustomCategoryName("");
      setShowCustomCategory(false);
      router.refresh();
    } finally {
      setIsSavingCustomCategory(false);
    }
  }

  return (
    <>
      {!initialTransaction && (
        <button
          aria-label="快速記帳"
          className="fixed bottom-6 right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#B8976C] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(24,57,47,0.24)] transition hover:-translate-y-0.5 hover:bg-[#A3835B] sm:bottom-8 sm:right-8"
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
            className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white px-5 pt-4 shadow-2xl sm:rounded-2xl sm:px-7 sm:pb-0"
            role="dialog"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#EFECE6] sm:hidden" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#8C827A]">家庭帳本</p>
                <h2 id="quick-transaction-title" className="mt-1 text-xl font-semibold">
                  {initialTransaction ? "編輯交易" : "快速記帳"}
                </h2>
              </div>
              <button
                aria-label="關閉"
                className="grid size-10 place-items-center rounded-full text-[#8C827A] hover:bg-[#E8DEC9]"
                onClick={closeModal}
                title="關閉"
                type="button"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 rounded-lg bg-[#E8DEC9] p-1">
              {transactionKinds.map(({ kind: option, label, icon: Icon }) => (
                <button
                  aria-pressed={kind === option}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition ${
                    kind === option
                      ? "bg-[#B8976C] text-white shadow-sm"
                      : "text-[#8C827A] hover:text-[#2C2623]"
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

            <form className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submitTransaction}>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4 pr-1">
                {initialTransaction && (
                  <input name="transaction_id" type="hidden" value={initialTransaction.id} />
                )}
                <input name="kind" type="hidden" value={kind} />
                <input name="category_id" type="hidden" value={categoryId} />
                <input name="scope" type="hidden" value={scope} />

                <label className="block rounded-xl border border-[#EFECE6] bg-white px-4 py-3">
                <span className="text-xs font-medium text-[#8C827A]">
                  金額 · {selectedAccount?.currency ?? accounts[0]?.currency ?? "TWD"}
                </span>
                <span className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-[#8C827A]">$</span>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight text-[#2C2623] outline-none placeholder:text-[#EFECE6] focus:ring-0"
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
                    <span className="text-xs text-[#8C827A]">可略過</span>
                  </div>
                  <div
                    aria-label="分類選擇"
                    className="flex max-w-full gap-2 overflow-x-auto pb-2"
                    role="group"
                  >
                    {displayCategories.map(({ category, fallbackName }) => {
                      const name = category?.name ?? fallbackName ?? "";
                      const Icon = getCategoryIcon(name, category?.icon);
                      const selected = category
                        ? categoryId === category.id
                        : fallbackCategory === name;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`flex h-16 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition ${
                            selected
                              ? "border-[#B8976C] bg-[#B8976C] text-white"
                              : "border-[#EFECE6] bg-white text-[#8C827A] hover:border-[#D4C3A3]"
                          }`}
                          key={category?.id ?? `fallback-${name}`}
                          onClick={() => {
                            if (category) {
                              setCategoryId(selected ? "" : category.id);
                              setFallbackCategory("");
                            } else {
                              setCategoryId("");
                              setFallbackCategory(selected ? "" : name);
                            }
                          }}
                          type="button"
                        >
                          <Icon size={17} />
                          <span className="max-w-full truncate">{name}</span>
                        </button>
                      );
                    })}
                    {(kind === "expense" || kind === "income") && (
                      <button
                        className="flex h-16 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#D4C3A3] bg-white px-2 py-2 text-xs font-medium text-[#6B573F] transition hover:bg-[#E8DEC9]"
                        onClick={() => {
                          setCustomCategoryError(null);
                          setShowCustomCategory(true);
                        }}
                        type="button"
                      >
                        <Plus size={17} />
                        <span>自訂分類</span>
                      </button>
                    )}
                  </div>
                  {fallbackCategoryOptions.length > 0 && (
                    <p className="mt-2 text-xs text-[#8C827A]">儲存時會自動加入家庭分類。</p>
                  )}
                </div>
                ) : null}

                {kind === "expense" && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">消費參與者</legend>
                    <div aria-label="費用歸屬" className="grid grid-cols-3 rounded-lg bg-[#E8DEC9] p-1" role="group">
                      {expenseScopes.map((option) => {
                        const Icon =
                          option === "personal"
                            ? UserRound
                            : option === "shared"
                              ? HeartHandshake
                              : HandCoins;
                        return (
                          <button
                            aria-pressed={scope === option}
                            className={`flex h-10 items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition sm:gap-1.5 sm:text-sm ${
                              scope === option
                                ? "bg-[#B8976C] text-white shadow-sm"
                                : "text-[#8C827A] hover:text-[#2C2623]"
                            }`}
                            key={option}
                            onClick={() => setScope(option)}
                            type="button"
                          >
                            <Icon aria-hidden="true" size={15} />
                            {expenseScopeLabels[option]}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <div className="border-t border-[#EFECE6] pt-3">
                <button
                  aria-expanded={showMoreOptions}
                  className="text-sm font-medium text-[#8C827A] underline decoration-[#EFECE6] underline-offset-4 hover:text-[#6B573F]"
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
                        className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
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
                      className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
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
                    className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
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
                    className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none placeholder:text-[#8C827A] focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
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
              </div>

              <div className="sticky bottom-0 -mx-5 grid gap-2 border-t border-[#EFECE6] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-7 sm:px-7 sm:pb-4">
                {!initialTransaction && (
                  <button
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EFECE6] bg-white text-sm font-semibold text-[#6B573F] transition hover:bg-[#E8DEC9] disabled:opacity-60"
                    disabled={isPending}
                    name="intent"
                    type="submit"
                    value="continue"
                  >
                    {isPending ? "儲存中…" : "新增後繼續"}
                  </button>
                )}
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#B8976C] text-sm font-semibold text-white transition hover:bg-[#A3835B] disabled:opacity-60"
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
          {showCustomCategory && (kind === "expense" || kind === "income") && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2C2623]/35 p-4">
              <section
                aria-labelledby="custom-category-title"
                aria-modal="true"
                className="w-full max-w-sm rounded-2xl border border-[#EFECE6] bg-white p-5 shadow-xl"
                role="dialog"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold" id="custom-category-title">
                    新增{kind === "income" ? "收入" : "支出"}分類
                  </h3>
                  <button
                    aria-label="關閉自訂分類"
                    className="grid size-9 place-items-center rounded-full text-[#8C827A] hover:bg-[#E8DEC9]"
                    onClick={() => setShowCustomCategory(false)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form className="mt-4 space-y-4" onSubmit={saveCustomCategory}>
                  <label className="block text-sm font-medium">
                    分類名稱
                    <input
                      autoFocus
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#EFECE6] px-3 text-sm outline-none focus:border-[#B8976C]"
                      maxLength={40}
                      onChange={(event) => setCustomCategoryName(event.target.value)}
                      placeholder={kind === "income" ? "例如：副業、退稅" : "例如：寵物用品"}
                      required
                      value={customCategoryName}
                    />
                  </label>
                  <fieldset>
                    <legend className="text-sm font-medium">選擇圖示</legend>
                    <div className="mt-2 grid grid-cols-6 gap-2">
                      {customCategoryIcons.map(({ key, label, icon: CategoryIcon }) => {
                        return (
                          <button
                            aria-label={`選擇${label}圖示`}
                            aria-pressed={customCategoryIcon === key}
                            className={`grid size-10 place-items-center rounded-lg border ${
                              customCategoryIcon === key
                                ? "border-[#B8976C] bg-[#E8DEC9] text-[#6B573F]"
                                : "border-[#EFECE6] text-[#8C827A]"
                            }`}
                            key={key}
                            onClick={() => setCustomCategoryIcon(key)}
                            type="button"
                          >
                            <CategoryIcon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  {customCategoryError && (
                    <p aria-live="polite" className="text-sm text-[#9f3e2e]" role="alert">
                      {customCategoryError}
                    </p>
                  )}
                  <button
                    className="h-11 w-full rounded-lg bg-[#B8976C] text-sm font-semibold text-white hover:bg-[#A3835B] disabled:opacity-60"
                    disabled={isSavingCustomCategory}
                    type="submit"
                  >
                    {isSavingCustomCategory ? "儲存中…" : "儲存並選取分類"}
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}