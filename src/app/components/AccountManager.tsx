'use client';

import { Fragment, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Banknote,
  ChevronDown,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

import {
  createAccountAction,
  deleteAccountAction,
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
import { DeleteConfirmationDialog } from "@/app/components/DeleteConfirmationDialog";

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
  if (type === "cash") return <Banknote size={16} />;
  if (type === "credit_card") return <CreditCard size={16} />;
  return <Landmark size={16} />;
}

function formatBalance(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("zh-TW")}`;
  }
}

function convertCurrency(amount: number, from: string, to: string, usdTwd: number) {
  if (from === to) return amount;
  if (from === "USD" && to === "TWD") return amount * usdTwd;
  if (from === "TWD" && to === "USD") return amount / usdTwd;
  return amount;
}

// 📈 股票投資組合管理器 (已套用焦糖色風格)
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
  const [deletingInvestment, setDeletingInvestment] = useState<InvestmentRow | null>(null);
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
    setPending(true);
    setError(null);
    try {
      const result = await deleteInvestment(investment.id, account.id);
      if (result.error) setError(result.error);
      else {
        setDeletingInvestment(null);
        router.refresh();
      }
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
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="font-extrabold text-lg text-[#2C2623]">{account.name} - 投資組合</h3>
          <p className="mt-1 text-xs font-bold text-[#8C827A] tracking-wider uppercase">報價可能延遲，市值依最近一次更新計算</p>
        </div>
        <button
          className="flex h-10 items-center gap-2 rounded-xl bg-[#FBF9F5] border border-[#E5E0D8] px-4 text-sm font-bold text-[#2C2623] hover:border-[#D2A782] transition-colors disabled:opacity-50"
          disabled={pending || !investments.length}
          onClick={() => void Promise.all(investments.map(handleRefresh))}
          type="button"
        >
          <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
          更新此帳戶股價
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-[#E5E0D8] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold text-[#8C827A] tracking-widest uppercase">目前市值</p>
          <p className="mt-2 break-words font-black text-xl text-[#2C2623] tabular-nums tracking-tight">
            {formatBalance(portfolio.value, account.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E5E0D8] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold text-[#8C827A] tracking-widest uppercase">未實現損益</p>
          <p className={`mt-2 break-words font-black text-xl tabular-nums tracking-tight ${profit < 0 ? "text-[#C15C54]" : "text-[#5E8B7E]"}`}>
            {profit >= 0 ? "+" : ""}{formatBalance(profit, account.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E5E0D8] bg-white p-5 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-bold text-[#8C827A] tracking-widest uppercase">整體報酬率</p>
          <p className={`mt-2 font-black text-xl tabular-nums tracking-tight ${profit < 0 ? "text-[#C15C54]" : "text-[#5E8B7E]"}`}>
            {profit >= 0 ? "+" : ""}{returnRate.toFixed(2)}%
          </p>
        </div>
      </div>

      {investments.length ? (
        <div className="space-y-3">
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
              <div className="p-5 rounded-2xl bg-[#FBF9F5] border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors" key={investment.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-extrabold text-base text-[#2C2623]">{investment.name}</p>
                      <span className="text-[10px] font-bold bg-white border border-[#E5E0D8] px-2 py-0.5 rounded-lg text-[#8C827A]">{investment.symbol}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-[10px] font-bold text-[#8C827A] uppercase">持有股數 / 現價</p>
                        <p className="text-sm font-bold text-[#2C2623] mt-0.5">
                          {shares.toLocaleString("zh-TW")} 股 <span className="text-[#8C827A] font-normal mx-1">@</span> {formatBalance(currentPrice, investment.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#8C827A] uppercase">持倉市值</p>
                        <p className="text-sm font-bold text-[#2C2623] mt-0.5">
                          {formatBalance(marketValue, investment.currency)}
                          {investment.currency === "USD" && <span className="text-xs text-[#8C827A] ml-1">({formatBalance(marketValueTwd, "TWD")})</span>}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-[#8C827A] uppercase">未實現損益 / 報酬率</p>
                        <p className={`text-sm font-bold mt-0.5 ${pnlInAccountCurrency < 0 ? "text-[#C15C54]" : "text-[#5E8B7E]"}`}>
                          {pnlInAccountCurrency >= 0 ? "+" : ""}{formatBalance(pnlInAccountCurrency, account.currency)} 
                          <span className="ml-2">({pnlInAccountCurrency >= 0 ? "+" : ""}{positionReturn.toFixed(2)}%)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-1 bg-white p-1 rounded-xl border border-[#E5E0D8]">
                    <button
                      aria-label={`編輯 ${investment.symbol}`}
                      className="rounded-lg p-2 text-[#8C827A] hover:bg-[#F5F2EC] hover:text-[#2C2623] transition-colors"
                      disabled={pending}
                      onClick={() => editInvestment(investment)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`更新 ${investment.symbol} 股價`}
                      className="rounded-lg p-2 text-[#8C827A] hover:bg-[#F5F2EC] hover:text-[#2C2623] transition-colors"
                      disabled={pending}
                      onClick={() => void handleRefresh(investment)}
                      type="button"
                    >
                      <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
                    </button>
                    <button
                      aria-label={`刪除 ${investment.symbol}`}
                      className="rounded-lg p-2 text-[#8C827A] hover:bg-[#F5F2EC] hover:text-[#C15C54] transition-colors"
                      disabled={pending}
                      onClick={() => setDeletingInvestment(investment)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-bold text-[#8C827A] tracking-wider uppercase">
                  Last updated: {new Date(investment.updated_at).toLocaleString("zh-TW")}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[#E5E0D8] bg-[#FBF9F5] px-5 py-8 text-center text-sm font-bold text-[#8C827A]">
          尚無股票持倉，新增後會以最新報價估算帳戶餘額。
        </p>
      )}

      {/* 新增/編輯表單 */}
      <form className="mt-6 rounded-2xl border border-[#E5E0D8] bg-white p-5 shadow-sm" onSubmit={handleSave}>
        <h4 className="text-base font-extrabold text-[#2C2623] mb-4">{editingId ? "編輯持倉明細" : "新增股票持倉"}</h4>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs font-bold text-[#8C827A] tracking-wider uppercase">
            市場
            <select
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-3 text-sm text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all font-medium"
              onChange={(event) => setMarket(event.target.value as "TW" | "US")}
              value={market}
            >
              <option value="TW">台股 (TWD)</option>
              <option value="US">美股 (USD)</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[#8C827A] tracking-wider uppercase">
            股票代號
            <input
              autoComplete="off"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-3 text-sm uppercase text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all font-bold"
              onChange={(event) => setSymbol(event.target.value)}
              placeholder={market === "TW" ? "2330" : "NVDA"}
              required
              value={symbol}
            />
          </label>
          <label className="text-xs font-bold text-[#8C827A] tracking-wider uppercase col-span-2 sm:col-span-1">
            股票名稱 (可留空自動帶入)
            <input
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-3 text-sm text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all font-medium"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="text-xs font-bold text-[#8C827A] tracking-wider uppercase col-span-2 sm:col-span-1">
            持有股數
            <input
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-3 text-sm text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all font-bold"
              min="0.000001"
              onChange={(event) => setShares(event.target.value)}
              required
              step="any"
              type="number"
              value={shares}
            />
          </label>
          <label className="col-span-2 text-xs font-bold text-[#8C827A] tracking-wider uppercase">
            平均買入單價
            <input
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-3 text-sm text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all font-bold"
              min="0.000001"
              onChange={(event) => setCostPrice(event.target.value)}
              required
              step="any"
              type="number"
              value={costPrice}
            />
          </label>
        </div>
        {error && <p aria-live="polite" className="mt-3 text-sm font-bold text-[#C15C54]" role="alert">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D2A782] text-sm font-bold text-white hover:bg-[#C18C6A] transition-colors shadow-sm disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            <Save size={16} />
            {pending ? "處理中…" : editingId ? "儲存修改" : "新增持倉並抓取報價"}
          </button>
          {editingId && (
            <button
              className="h-11 rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-5 text-sm font-bold text-[#2C2623] hover:border-[#D1CCC5] transition-colors"
              onClick={resetForm}
              type="button"
            >
              取消
            </button>
          )}
        </div>
      </form>

      <DeleteConfirmationDialog
        description={
          deletingInvestment
            ? `確定要刪除「${deletingInvestment.name}（${deletingInvestment.symbol}）」持倉明細嗎？此操作將無法復原。`
            : ""
        }
        error={error}
        onCancel={() => setDeletingInvestment(null)}
        onConfirm={() => {
          if (deletingInvestment) void handleDelete(deletingInvestment);
        }}
        open={deletingInvestment !== null}
        pending={pending}
        title="確認要刪除此股票持倉嗎？"
      />
    </div>
  );
}

// 🗂️ 帳戶新增與編輯 Modal (已套用焦糖色風格)
function AccountForm({
  account,
  defaultAccountId,
  onClose,
}: {
  account: DashboardAccount | null;
  defaultAccountId: string | null;
  onClose: () => void;
}) {
  const action = account ? updateAccountAction : createAccountAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [onClose, state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2623]/20 backdrop-blur-sm sm:items-center p-4">
      <section
        aria-labelledby="account-form-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200"
        role="dialog"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#8C827A] uppercase">家庭帳戶管理</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#2C2623]" id="account-form-title">
              {account ? "編輯帳戶設定" : "新增帳戶"}
            </h2>
          </div>
          <button
            aria-label="關閉"
            className="w-10 h-10 rounded-full border border-[#E5E0D8] bg-[#FBF9F5] flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-colors"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="space-y-5">
          {account && <input name="account_id" type="hidden" value={account.id} />}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#8C827A] uppercase tracking-wider">帳戶名稱</span>
            <input
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 text-sm font-bold text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all"
              defaultValue={account?.name ?? ""}
              maxLength={80}
              name="name"
              placeholder="例如：日常現金、中國信託"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#8C827A] uppercase tracking-wider">帳戶類型</span>
              <select
                className="h-12 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 text-sm font-bold text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all"
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
              <span className="mb-1.5 block text-xs font-bold text-[#8C827A] uppercase tracking-wider">幣別</span>
              <input
                className="h-12 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 text-sm font-bold uppercase text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all"
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
            <span className="mb-1.5 block text-xs font-bold text-[#8C827A] uppercase tracking-wider">期初餘額</span>
            <input
              className="h-12 w-full rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 text-sm font-bold text-[#2C2623] outline-none focus:border-[#D2A782] focus:ring-1 focus:ring-[#D2A782] transition-all tabular-nums"
              defaultValue={account?.opening_balance ?? 0}
              inputMode="decimal"
              name="opening_balance"
              step="0.01"
              type="number"
            />
          </label>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 py-3.5 cursor-pointer hover:border-[#D1CCC5] transition-colors">
              <input
                className="w-5 h-5 accent-[#D2A782]"
                defaultChecked={account?.is_shared ?? true}
                name="is_shared"
                type="checkbox"
              />
              <span className="text-sm font-bold text-[#2C2623]">設為家庭共同帳戶</span>
            </label>

            {account && (
              <label className="flex items-center gap-3 rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] px-4 py-3.5 cursor-pointer hover:border-[#D1CCC5] transition-colors">
                <input
                  className="w-5 h-5 accent-[#D2A782]"
                  defaultChecked={defaultAccountId === account.id}
                  name="is_default_account"
                  type="checkbox"
                />
                <span className="text-sm font-bold text-[#2C2623]">設為預設扣款帳戶</span>
              </label>
            )}
          </div>

          {state.error && (
            <p aria-live="polite" className="rounded-xl bg-[#FFF5F5] border border-[#FFEAEA] px-4 py-3 text-sm font-bold text-[#C15C54]" role="alert">
              {state.error}
            </p>
          )}

          <button
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#D2A782] text-sm font-extrabold text-white shadow-sm hover:bg-[#C18C6A] transition-colors disabled:opacity-60 mt-2"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "處理中…" : account ? "儲存變更" : "建立帳戶"}
          </button>
        </form>
      </section>
    </div>
  );
}

// 🗑️ 刪除帳戶按鈕模組
function DeleteAccountForm({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initialState);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} ref={formRef}>
      <input name="account_id" type="hidden" value={accountId} />
      {state.error && (
        <p aria-live="polite" className="absolute mt-10 text-xs font-bold text-[#C15C54]" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="p-2 rounded-lg text-[#8C827A] hover:bg-[#FFF5F5] hover:text-[#C15C54] transition-colors disabled:opacity-50"
        disabled={isPending}
        onClick={() => setIsConfirmationOpen(true)}
        title="刪除此帳戶"
        type="button"
      >
        <Trash2 size={16} />
      </button>
      <DeleteConfirmationDialog
        description={`確定要刪除「${accountName}」帳戶嗎？此操作將無法復原。`}
        error={state.error}
        onCancel={() => setIsConfirmationOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        open={isConfirmationOpen && !state.success}
        pending={isPending}
        title="確認要刪除此帳戶嗎？"
      />
    </form>
  );
}

// 🏠 主介面元件：融合完整邏輯與焦糖侘寂風
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
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. 自動辨識並分離「銀行帳戶」與「其他帳戶」
  const bankAccounts = accounts.filter(
    (a) => a.account_type === 'bank' || a.name?.includes('銀行') || a.account_type === 'cash'
  );
  const otherAccounts = accounts.filter(
    (a) => a.account_type !== 'bank' && !a.name?.includes('銀行') && a.account_type !== 'cash'
  );

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  // 保留原始的幣別加總文字邏輯
  const totalsByCurrency = accounts.reduce<Record<string, number>>((totals, account) => {
    totals[account.currency] = (totals[account.currency] ?? 0) + account.balance;
    return totals;
  }, {});

  // 執行全域更新股價 API
  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshMessage(null);
    try {
      const result = await refreshAllInvestments();
      if (result.error) {
        setRefreshMessage(result.error);
        return;
      }
      const failures = result.failed.length ? `；失敗：${result.failed.join("、")}` : "";
      setRefreshMessage(`已更新 ${result.refreshed} 檔證券${failures}`);
      if (result.refreshed > 0) router.refresh();
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "更新證券股價失敗。");
    } finally {
      setRefreshingAll(false);
    }
  };

  const isInvestmentAccount = (type: string) => {
    return ["investment", "stock", "securities"].includes(type);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-[#E5E0D8] shadow-sm p-6 sm:p-8">
      {/* 頂部控制列 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#2C2623]">家庭帳戶</h2>
          <p className="text-xs text-[#8C827A] mt-1">現金、銀行與信用卡帳戶</p>
          <div className="mt-3 text-[#2C2623] font-bold">
            合計 <span className="text-xl ml-2 tracking-tight">${totalBalance.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {investments.length > 0 && (
            <button 
              onClick={() => void handleRefreshAll()}
              disabled={refreshingAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#D2A782] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#C18C6A] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={15} className={refreshingAll ? "animate-spin" : ""} />
              {refreshingAll ? "更新中..." : "更新所有證券股價"}
            </button>
          )}
          
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E5E0D8] bg-[#FBF9F5] rounded-xl text-sm font-bold text-[#2C2623] hover:border-[#D1CCC5] transition-colors cursor-pointer"
          >
            <Plus size={16} />
            新增帳戶
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 border border-[#E5E0D8] bg-white rounded-xl flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-all cursor-pointer"
          >
            <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {refreshMessage && (
        <div className="mb-4 px-4 py-2.5 bg-[#FBF9F5] border border-[#E5E0D8] rounded-xl text-xs font-bold text-[#8C827A] inline-block">
          {refreshMessage}
        </div>
      )}

      {accounts.length === 0 && isExpanded && (
        <div className="mt-4 rounded-2xl border border-dashed border-[#E5E0D8] bg-[#FBF9F5] px-5 py-8 text-center text-sm font-bold text-[#8C827A]">
          尚未建立任何帳戶，請點擊右上方「新增帳戶」。
        </div>
      )}

      {/* 💳 預設永遠顯示的「現金與銀行帳戶」區塊 */}
      {bankAccounts.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase ml-2">主要現金與銀行</p>
          {bankAccounts.map((a) => (
            <div key={a.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-[#FBF9F5] rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E0D8] flex items-center justify-center text-[#D2A782] shadow-sm">
                  <AccountIcon type={a.account_type} />
                </div>
                <div>
                  <span className="font-extrabold text-base text-[#2C2623] block">{a.name}</span>
                  <span className="text-[10px] font-bold text-[#8C827A] tracking-wider mt-0.5 block">
                    {accountTypeLabels[a.account_type]} {!a.is_shared && "· 👤 個人"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-auto w-full sm:w-auto justify-end border-t border-[#E5E0D8] sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                <span className="font-black text-lg text-[#5E8B7E] tracking-tight mr-2">{formatBalance(a.balance, a.currency)}</span>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E5E0D8]">
                  <button onClick={() => setEditingAccount(a)} className="p-2 text-[#8C827A] hover:bg-[#F5F2EC] hover:text-[#2C2623] rounded-lg transition-colors"><Pencil size={15}/></button>
                  <DeleteAccountForm accountId={a.id} accountName={a.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🗂️ 點擊箭頭才顯示的「其他資產與證券」區塊 */}
      {isExpanded && otherAccounts.length > 0 && (
        <div className="space-y-3 pt-6 mt-6 border-t border-[#F5F2EC] animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase ml-2">其他資產與證券</p>
          {otherAccounts.map((a) => {
            const supportsStocks = isInvestmentAccount(a.account_type);
            
            return (
              <div key={a.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-white rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FBF9F5] border border-[#E5E0D8] flex items-center justify-center text-[#8C827A]">
                    <AccountIcon type={a.account_type} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-[#8C827A]">{a.name}</span>
                      {supportsStocks && (
                        <button 
                          onClick={() => setPortfolioAccountId(portfolioAccountId === a.id ? null : a.id)}
                          className={`ml-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${portfolioAccountId === a.id ? 'bg-[#D2A782] text-white shadow-sm' : 'bg-[#FBF9F5] border border-[#E5E0D8] text-[#D2A782] hover:bg-[#D2A782] hover:text-white'}`}
                        >
                          股票明細 ↗
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-[#8C827A] tracking-wider mt-0.5 block">
                      {accountTypeLabels[a.account_type]} {!a.is_shared && "· 👤 個人"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 self-end sm:self-auto w-full sm:w-auto justify-end border-t border-[#F5F2EC] sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <span className="font-black text-lg text-[#2C2623] tracking-tight mr-2">{formatBalance(a.balance, a.currency)}</span>
                  <div className="flex items-center gap-1 bg-[#FBF9F5] p-1 rounded-xl border border-[#E5E0D8]">
                    <button onClick={() => setEditingAccount(a)} className="p-2 text-[#8C827A] hover:bg-white hover:text-[#2C2623] rounded-lg transition-colors shadow-sm"><Pencil size={15}/></button>
                    <DeleteAccountForm accountId={a.id} accountName={a.name} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📈 股票明細彈出 Modal */}
      {portfolioAccountId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2C2623]/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 border-b border-[#E5E0D8] flex justify-between items-center bg-[#FBF9F5] sticky top-0 z-10 rounded-t-[2rem]">
              <div>
                <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase">投資部位管理</p>
                <h3 className="text-xl font-extrabold text-[#2C2623] mt-1">
                  {accounts.find(a => a.id === portfolioAccountId)?.name || "證券帳戶"}
                </h3>
              </div>
              <button 
                onClick={() => setPortfolioAccountId(null)} 
                className="w-10 h-10 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-colors shadow-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto bg-[#FBF9F5]/30">
              <StockPortfolioManager 
                account={accounts.find(a => a.id === portfolioAccountId)!} 
                investments={investments.filter(i => i.account_id === portfolioAccountId)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* 新增/編輯帳戶 Modal */}
      {(isCreating || editingAccount) && (
        <AccountForm
          account={editingAccount}
          defaultAccountId={defaultAccountId}
          onClose={() => {
            setIsCreating(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}
