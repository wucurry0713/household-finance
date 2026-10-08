"use client";

import { Fragment, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Banknote,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

import {
  createAccountAction,
  deleteAccountAction,
  setDefaultAccountAction,
  updateAccountAction,
  type AccountActionState,
} from "@/app/actions/accounts";
import {
  createInvestment,
  deleteInvestment,
  refreshAllInvestments,
  refreshInvestment,
  updateInvestment,
  type InvestmentRow,
} from "@/app/actions/investments";
import { accountTypes, type AccountType } from "@/lib/finance/account-types";
import type { DashboardAccount } from "@/lib/finance/dashboard";

const initialState: AccountActionState = { error: null, success: false };

const accountTypeLabels: Record<AccountType, string> = {
  cash: "現金",
  bank: "銀行存款",
  credit_card: "信用卡（舊類型）",
  investment: "投資部位",
  loan: "貸款",
  stock: "股票",
  securities: "證券",
  asset: "其他資產",
  real_estate: "房地產",
  vehicle: "車輛",
  liability: "負債",
  other: "其他（舊類型）",
};

const accountTypeOptions = accountTypes.map((value) => ({
  value,
  label: accountTypeLabels[value],
}));

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

function convertCurrency(amount: number, from: string, to: string, usdTwd: number) {
  if (from === to) return amount;
  if (from === "USD" && to === "TWD") return amount * usdTwd;
  if (from === "TWD" && to === "USD") return amount / usdTwd;
  return amount;
}

function StockPortfolioManager({
  account,
  investments,
}: {
  account: DashboardAccount;
  investments: InvestmentRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [market, setMarket] = useState<"TW" | "US">("TW");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const didCheckPrices = useRef(false);

  useEffect(() => {
    if (didCheckPrices.current) return;
    didCheckPrices.current = true;
    const staleInvestments = investments.filter(
      (investment) => Date.now() - Date.parse(investment.updated_at) > 15 * 60 * 1000,
    );
    if (!staleInvestments.length) return;
    let cancelled = false;
    void Promise.all(
      staleInvestments.map((investment) => refreshInvestment(investment.id, account.id)),
    )
      .then((results) => {
        if (cancelled) return;
        const failedResult = results.find((result) => result.error);
        if (failedResult?.error) setError(failedResult.error);
        if (results.some((result) => !result.error)) router.refresh();
      })
      .catch((refreshError: unknown) => {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "自動更新股價失敗。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account.id, investments, router]);

  const resetForm = () => {
    setEditingId(null);
    setSymbol("");
    setName("");
    setShares("");
    setCostPrice("");
    setError(null);
  };

  const editInvestment = (investment: InvestmentRow) => {
    setEditingId(investment.id);
    setMarket(investment.currency === "TWD" ? "TW" : "US");
    setSymbol(investment.symbol);
    setName(investment.name);
    setShares(String(investment.shares));
    setCostPrice(String(investment.cost_price));
    setError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const normalizedSymbol =
      market === "TW" && !/\.(TW|TWO)$/i.test(symbol.trim())
        ? `${symbol.trim()}.TW`
        : symbol.trim();
    const input = {
      accountId: account.id,
      symbol: normalizedSymbol,
      name,
      shares: Number(shares),
      costPrice: Number(costPrice),
    };
    try {
      const result = editingId
        ? await updateInvestment(editingId, input)
        : await createInvestment(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      resetForm();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const handleRefresh = async (investment: InvestmentRow) => {
    setPending(true);
    setError(null);
    try {
      const result = await refreshInvestment(investment.id, account.id);
      if (result.error) setError(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (investment: InvestmentRow) => {
    if (!window.confirm(`確定刪除 ${investment.symbol} 的持倉明細？`)) return;
    setPending(true);
    setError(null);
    try {
      const result = await deleteInvestment(investment.id, account.id);
      if (result.error) setError(result.error);
      else router.refresh();
    } finally {
      setPending(false);
    }
  };

  const portfolio = investments.reduce(
    (total, investment) => {
      const quantity = Number(investment.shares);
      const cost = Number(investment.cost_price) * quantity;
      const value = Number(investment.current_price) * quantity;
      return {
        cost:
          total.cost +
          convertCurrency(cost, investment.currency, account.currency, Number(investment.exchange_rate)),
        value:
          total.value +
          convertCurrency(value, investment.currency, account.currency, Number(investment.exchange_rate)),
      };
    },
    { cost: 0, value: 0 },
  );
  const profit = portfolio.value - portfolio.cost;
  const returnRate = portfolio.cost > 0 ? (profit / portfolio.cost) * 100 : 0;

  return (
    <div className="col-span-2 mt-2 rounded-xl border border-[#EFECE6] bg-white p-4 sm:w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#2C2623]">股票投資組合</h3>
          <p className="mt-1 text-xs text-[#8C827A]">報價可能延遲，以下市值依最近一次更新價格計算。</p>
        </div>
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[#EFECE6] px-3 text-xs font-semibold text-[#6B573F] disabled:opacity-50"
          disabled={pending || !investments.length}
          onClick={() => void Promise.all(investments.map(handleRefresh))}
          type="button"
        >
          <RefreshCw size={14} />
          更新全部股價
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-[#8C827A]">目前市值</p>
          <p className="mt-1 break-words text-right font-mono text-sm font-semibold tabular-nums">{formatBalance(portfolio.value, account.currency)}</p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-[#8C827A]">未實現損益</p>
          <p className={`mt-1 break-words text-right font-mono text-sm font-semibold tabular-nums ${profit < 0 ? "text-[#a05b48]" : "text-[#6B573F]"}`}>
            {formatBalance(profit, account.currency)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-[#8C827A]">整體報酬率</p>
          <p className={`mt-1 text-right font-mono text-sm font-semibold tabular-nums ${profit < 0 ? "text-[#a05b48]" : "text-[#6B573F]"}`}>
            {returnRate.toFixed(2)}%
          </p>
        </div>
      </div>

      {investments.length ? (
        <div className="mt-4 divide-y divide-[#EFECE6]">
          {investments.map((investment) => {
            const shares = Number(investment.shares);
            const currentPrice = Number(investment.current_price);
            const costPrice = Number(investment.cost_price);
            const marketValue = currentPrice * shares;
            const costValue = costPrice * shares;
            const pnl = marketValue - costValue;
            const positionReturn = costValue > 0 ? (pnl / costValue) * 100 : 0;
            const marketValueTwd = convertCurrency(
              marketValue,
              investment.currency,
              "TWD",
              Number(investment.exchange_rate),
            );
            const pnlInAccountCurrency = convertCurrency(
              pnl,
              investment.currency,
              account.currency,
              Number(investment.exchange_rate),
            );
            return (
              <div className="py-3" key={investment.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">
                      {investment.name} <span className="text-xs font-normal text-[#8C827A]">{investment.symbol}</span>
                    </p>
                    <p className="mt-1 text-right font-mono text-xs tabular-nums text-[#8C827A]">
                      {shares.toLocaleString("zh-TW")} 股 · 現價{" "}
                      {formatBalance(currentPrice, investment.currency)}
                    </p>
                    <p className="mt-1 text-right font-mono text-xs tabular-nums text-[#8C827A]">
                      持倉市值 {formatBalance(marketValue, investment.currency)}
                      {investment.currency === "USD" && (
                        <> · 約 {formatBalance(marketValueTwd, "TWD")}</>
                      )}
                    </p>
                    <p className={`mt-1 text-right font-mono text-xs font-medium tabular-nums ${pnlInAccountCurrency < 0 ? "text-[#a05b48]" : "text-[#6B573F]"}`}>
                      未實現損益 {formatBalance(pnlInAccountCurrency, account.currency)} ·{" "}
                      {positionReturn.toFixed(2)}%
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      aria-label={`編輯 ${investment.symbol}`}
                      className="rounded-md p-2 text-[#8C827A] hover:bg-white"
                      disabled={pending}
                      onClick={() => editInvestment(investment)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`更新 ${investment.symbol} 股價`}
                      className="rounded-md p-2 text-[#8C827A] hover:bg-white"
                      disabled={pending}
                      onClick={() => void handleRefresh(investment)}
                      type="button"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      aria-label={`刪除 ${investment.symbol}`}
                      className="rounded-md p-2 text-[#9f3e2e] hover:bg-white"
                      disabled={pending}
                      onClick={() => void handleDelete(investment)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[#8C827A]">
                  更新時間 {new Date(investment.updated_at).toLocaleString("zh-TW")}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[#EFECE6] px-3 py-5 text-center text-sm text-[#8C827A]">
          尚無股票持倉，新增後會以最新報價估算帳戶餘額。
        </p>
      )}

      <form className="mt-4 space-y-3 border-t border-[#EFECE6] pt-4" onSubmit={handleSave}>
        <h4 className="text-sm font-semibold">{editingId ? "編輯持倉" : "新增股票"}</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[#8C827A]">
            市場
            <select
              className="mt-1 h-10 w-full rounded-lg border border-[#EFECE6] bg-white px-2 text-sm text-[#2C2623]"
              onChange={(event) => setMarket(event.target.value as "TW" | "US")}
              value={market}
            >
              <option value="TW">台股 (TWD)</option>
              <option value="US">美股 (USD)</option>
            </select>
          </label>
          <label className="text-xs text-[#8C827A]">
            股票代號
            <input
              autoComplete="off"
              className="mt-1 h-10 w-full rounded-lg border border-[#EFECE6] bg-white px-2 text-sm uppercase text-[#2C2623]"
              onChange={(event) => setSymbol(event.target.value)}
              placeholder={market === "TW" ? "2330" : "NVDA"}
              required
              value={symbol}
            />
          </label>
          <label className="text-xs text-[#8C827A]">
            股票名稱（可留空自動帶入）
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#EFECE6] bg-white px-2 text-sm text-[#2C2623]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="text-xs text-[#8C827A]">
            持有股數
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#EFECE6] bg-white px-2 text-sm text-[#2C2623]"
              min="0.000001"
              onChange={(event) => setShares(event.target.value)}
              required
              step="any"
              type="number"
              value={shares}
            />
          </label>
          <label className="col-span-2 text-xs text-[#8C827A]">
            平均買入單價
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#EFECE6] bg-white px-2 text-sm text-[#2C2623]"
              min="0.000001"
              onChange={(event) => setCostPrice(event.target.value)}
              required
              step="any"
              type="number"
              value={costPrice}
            />
          </label>
        </div>
        {error && <p aria-live="polite" className="text-sm text-[#9f3e2e]" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#B8976C] text-sm font-semibold text-white disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            <Save size={15} />
            {pending ? "處理中…" : editingId ? "儲存修改" : "新增持倉並抓取報價"}
          </button>
          {editingId && (
            <button
              className="h-10 rounded-lg border border-[#EFECE6] px-3 text-sm text-[#8C827A]"
              onClick={resetForm}
              type="button"
            >
              取消
            </button>
          )}
        </div>
      </form>
    </div>
  );
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
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#8C827A]">家庭帳戶</p>
            <h2 className="mt-1 text-xl font-semibold" id="account-form-title">
              {account ? "編輯帳戶" : "新增帳戶"}
            </h2>
          </div>
          <button
            aria-label="關閉"
            className="grid size-10 place-items-center rounded-full text-[#8C827A] hover:bg-[#E8DEC9]"
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
              className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
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
                className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C]"
                defaultValue={account?.account_type ?? "cash"}
                name="account_type"
                required
              >
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">幣別</span>
              <input
                className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm uppercase outline-none focus:border-[#B8976C]"
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
              className="h-11 w-full rounded-lg border border-[#EFECE6] bg-white px-3 text-sm outline-none focus:border-[#B8976C]"
              defaultValue={account?.opening_balance ?? 0}
              inputMode="decimal"
              name="opening_balance"
              step="0.01"
              type="number"
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-[#EFECE6] bg-white px-3 py-3 text-sm">
            <input
              className="size-4 accent-[#B8976C]"
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
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#B8976C] text-sm font-semibold text-white transition hover:bg-[#A3835B] disabled:opacity-60"
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
        className="rounded-md p-2 text-[#8C827A] transition hover:bg-[#fff0ed] hover:text-[#9f3e2e] disabled:opacity-50"
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
              ? "bg-[#E8DEC9] text-[#6B573F]"
              : "text-[#8C827A] hover:bg-[#E8DEC9] hover:text-[#6B573F]"
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
  investments,
}: {
  accounts: DashboardAccount[];
  defaultAccountId: string | null;
  investments: InvestmentRow[];
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DashboardAccount | null>(null);
  const [portfolioAccountId, setPortfolioAccountId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshMessage(null);
    try {
      const result = await refreshAllInvestments();
      if (result.error) {
        setRefreshMessage(result.error);
        return;
      }
      const failures = result.failed.length
        ? `；失敗：${result.failed.join("、")}`
        : "";
      setRefreshMessage(`已更新 ${result.refreshed} 檔證券${failures}`);
      if (result.refreshed > 0) router.refresh();
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "更新證券股價失敗。");
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <section className="border-y border-[#EFECE6] bg-white px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">家庭帳戶</h2>
          <p className="mt-1 text-sm text-[#8C827A]">現金、銀行與信用卡帳戶</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {investments.length > 0 && (
            <button
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#B8976C] px-3 text-sm font-semibold text-white transition hover:bg-[#A3835B] disabled:cursor-wait disabled:opacity-60"
              disabled={refreshingAll}
              onClick={() => void handleRefreshAll()}
              type="button"
            >
              <RefreshCw className={refreshingAll ? "animate-spin" : ""} size={16} />
              {refreshingAll ? "更新中…" : "更新所有證券股價"}
            </button>
          )}
          <button
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#EFECE6] px-3 text-sm font-semibold text-[#6B573F] transition hover:bg-[#E8DEC9]"
            onClick={() => setIsCreating(true)}
            type="button"
          >
            <Plus size={17} />
            新增帳戶
          </button>
        </div>
      </div>
      {refreshMessage && (
        <p aria-live="polite" className="mt-3 text-xs text-[#8C827A]" role="status">
          {refreshMessage}
        </p>
      )}

      {accounts.length ? (
        <div className="ledgero-scrollbar mt-5 max-h-[400px] overflow-y-auto overscroll-contain divide-y divide-[#E8DEC9]">
          {accounts.map((account) => {
            const supportsStocks = ["investment", "stock", "securities"].includes(account.account_type);
            return (
              <Fragment key={account.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3.5 sm:flex sm:gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#E8DEC9] text-[#6B573F]">
                      <AccountIcon type={account.account_type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="truncate text-sm font-medium">{account.name}</p>
                        <span className="text-xs text-[#8C827A]">{accountTypeLabels[account.account_type]}</span>
                        {!account.is_shared && <span className="text-xs text-[#8C827A]">個人</span>}
                      </div>
                      <p className="mt-1 text-right font-mono text-xs tabular-nums text-[#8C827A]">
                        期初 {formatBalance(account.opening_balance, account.currency)}
                      </p>
                    </div>
                  </div>
                  <p className="min-w-0 max-w-32 text-right font-mono text-sm font-semibold tabular-nums text-[#2C2623] [overflow-wrap:anywhere] sm:max-w-none sm:whitespace-nowrap">
                    {formatBalance(account.balance, account.currency)}
                  </p>
                  <div className="col-span-2 flex items-center justify-end gap-1 sm:ml-auto">
                    {supportsStocks && (
                      <button
                        aria-expanded={portfolioAccountId === account.id}
                        aria-label={`管理 ${account.name} 股票明細`}
                        className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium ${
                          portfolioAccountId === account.id
                            ? "bg-[#E8DEC9] text-[#6B573F]"
                            : "text-[#8C827A] hover:bg-[#E8DEC9]"
                        }`}
                        onClick={() => setPortfolioAccountId(
                          portfolioAccountId === account.id ? null : account.id,
                        )}
                        title="股票明細"
                        type="button"
                      >
                        <TrendingUp size={14} />
                        股票明細
                      </button>
                    )}
                    <SetDefaultAccountForm
                      accountId={account.id}
                      isDefault={defaultAccountId === account.id}
                    />
                    <button
                      aria-label={`編輯 ${account.name}`}
                      className="rounded-md p-2 text-[#8C827A] transition hover:bg-[#E8DEC9] hover:text-[#6B573F]"
                      onClick={() => setEditingAccount(account)}
                      title="編輯帳戶"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteAccountForm accountId={account.id} />
                  </div>
                </div>
                {portfolioAccountId === account.id && supportsStocks && (
                  <StockPortfolioManager
                    account={account}
                    investments={investments.filter((investment) => investment.account_id === account.id)}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-[#EFECE6] px-5 py-8 text-center text-sm text-[#8C827A]">
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