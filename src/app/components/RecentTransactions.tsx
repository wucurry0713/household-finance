"use client";

import { useActionState, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  deleteTransactionAction,
  exportTransactionsAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import type { DashboardAccount, DashboardTransaction } from "@/lib/finance/dashboard";
import type { Database } from "@/types/database";
import { QuickTransactionModal } from "@/app/components/QuickTransactionModal";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type ExportScope = "current_month" | "month" | "all";

const initialState: TransactionActionState = {
  error: null,
  success: false,
  intent: null,
};

function formatMoney(amount: number, currency: string) {
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

function DeleteTransactionForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, isPending] = useActionState(deleteTransactionAction, initialState);
  return (
    <form action={formAction}>
      <input name="transaction_id" type="hidden" value={transactionId} />
      <button
        aria-label="刪除交易"
        className="grid size-9 place-items-center rounded-md text-[#87948c] transition hover:bg-[#fff0ed] hover:text-[#a14131] disabled:opacity-50"
        disabled={isPending}
        title="刪除交易"
        type="submit"
      >
        <Trash2 size={16} />
      </button>
      {state.error && (
        <p aria-live="polite" className="absolute right-4 z-10 mt-1 max-w-64 rounded bg-[#fff0ed] p-2 text-xs text-[#9f3e2e]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RecentTransactions({
  accounts,
  categories,
  transactions,
  viewOwnerId,
}: {
  accounts: DashboardAccount[];
  categories: Category[];
  transactions: DashboardTransaction[];
  viewOwnerId?: string | null;
}) {
  const [editingTransaction, setEditingTransaction] = useState<DashboardTransaction | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>("current_month");
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();

  function downloadCsv() {
    setExportError(null);
    startExport(async () => {
      const result = await exportTransactionsAction(exportScope, exportMonth, viewOwnerId ?? null);
      if (result.error || !result.rows) {
        setExportError(result.error ?? "匯出失敗，請稍後再試。");
        return;
      }

      const headers = ["日期", "類型", "金額", "幣別", "類別", "扣款／來源帳戶", "記帳者", "備註"];
      const protectFormula = (value: string) => /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
      const quote = (value: string | number) =>
        `"${String(value).replaceAll('"', '""')}"`;
      const lines = [
        headers,
        ...result.rows.map((row) => [
          row.date,
          row.kind,
          row.amount,
          row.currency,
          protectFormula(row.category),
          protectFormula(row.account),
          protectFormula(row.owner),
          protectFormula(row.notes),
        ]),
      ];
      const csv = `\uFEFF${lines.map((line) => line.map(quote).join(",")).join("\r\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const suffix =
        exportScope === "all"
          ? "全部"
          : exportScope === "month"
            ? exportMonth
            : "本月";
      anchor.href = url;
      anchor.download = `家庭交易報表-${suffix}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return (
    <section className="border-y border-[#dce5de] bg-white px-5 py-6 sm:px-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#718078]">家庭帳本</p>
          <h2 className="mt-1 font-semibold">最近交易</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="CSV 匯出範圍"
            className="h-9 rounded-lg border border-[#d6dfd9] bg-white px-2.5 text-xs text-[#52665d] outline-none focus:border-[#237457]"
            onChange={(event) => setExportScope(event.target.value as ExportScope)}
            value={exportScope}
          >
            <option value="current_month">本月交易</option>
            <option value="month">指定月份</option>
            <option value="all">全部交易</option>
          </select>
          {exportScope === "month" && (
            <input
              aria-label="選擇匯出月份"
              className="h-9 rounded-lg border border-[#d6dfd9] bg-white px-2 text-xs text-[#52665d] outline-none focus:border-[#237457]"
              onChange={(event) => setExportMonth(event.target.value)}
              type="month"
              value={exportMonth}
            />
          )}
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#cddbd1] px-3 text-xs font-semibold text-[#285943] transition hover:bg-[#eff5ef] disabled:cursor-wait disabled:opacity-60"
            disabled={isExporting}
            onClick={downloadCsv}
            type="button"
          >
            <Download size={15} />
            {isExporting ? "準備中…" : "匯出 CSV"}
          </button>
        </div>
      </div>
      {exportError && (
        <p aria-live="polite" className="mt-3 text-sm text-[#9f3e2e]" role="alert">
          {exportError}
        </p>
      )}

      {transactions.length ? (
        <div className="mt-4 divide-y divide-[#edf1ed]">
          {transactions.map((transaction) => {
            const isIncome = transaction.kind === "income";
            const isTransfer = transaction.kind === "transfer";
            const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowDownLeft : ArrowUpRight;
            const detail = isTransfer
              ? `${transaction.accountName ?? "帳戶"} → ${transaction.destinationName ?? "帳戶"}`
              : [transaction.categoryName, transaction.accountName]
                  .filter(Boolean)
                  .join(" · ") || "未分類";

            return (
              <article className="flex min-w-0 items-center gap-3 py-3.5" key={transaction.id}>
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    isIncome
                      ? "bg-[#eaf4ed] text-[#2f7957]"
                      : isTransfer
                        ? "bg-[#edf1ed] text-[#64766d]"
                        : "bg-[#fff1e9] text-[#ab6942]"
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {transaction.notes || transaction.description || (isTransfer ? "帳戶轉帳" : detail)}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#829088]">
                    {new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString("zh-TW", {
                      month: "numeric",
                      day: "numeric",
                    })}
                    {" · "}
                    {detail}
                  </p>
                </div>
                <p
                  className={`whitespace-nowrap text-sm font-semibold ${
                    isIncome ? "text-[#2f7957]" : isTransfer ? "text-[#65766d]" : "text-[#18392f]"
                  }`}
                >
                  {isIncome ? "+" : isTransfer ? "" : "−"}
                  {formatMoney(transaction.amount, transaction.currency)}
                </p>
                <button
                  aria-label="編輯交易"
                  className="grid size-9 shrink-0 place-items-center rounded-md text-[#87948c] transition hover:bg-[#edf2ee] hover:text-[#285943]"
                  onClick={() => setEditingTransaction(transaction)}
                  title="編輯交易"
                  type="button"
                >
                  <Pencil size={16} />
                </button>
                <DeleteTransactionForm transactionId={transaction.id} />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[#d5dfd8] px-5 py-10 text-center text-sm text-[#77857e]">
          尚無交易紀錄，使用「記一筆」開始記帳。
        </div>
      )}

      {editingTransaction && (
        <QuickTransactionModal
          accounts={accounts}
          categories={categories}
          initialTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </section>
  );
}