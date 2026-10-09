"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
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
import { ExcelExportButton } from "@/app/components/ExcelExportButton";
import { DeleteConfirmationDialog } from "@/app/components/DeleteConfirmationDialog";

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
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("zh-TW")}`;
  }
}

function DeleteTransactionForm({
  transactionId,
  description,
}: {
  transactionId: string;
  description: string;
}) {
  const [state, formAction, isPending] = useActionState(deleteTransactionAction, initialState);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} ref={formRef}>
      <input name="transaction_id" type="hidden" value={transactionId} />
      <button
        aria-label="刪除交易"
        className="grid size-9 place-items-center rounded-md text-[#8C827A] transition hover:bg-[#fff0ed] hover:text-[#a14131] disabled:opacity-50"
        disabled={isPending}
        onClick={() => setIsConfirmationOpen(true)}
        title="刪除交易"
        type="button"
      >
        <Trash2 size={16} />
      </button>
      <DeleteConfirmationDialog
        description={`確定要刪除「${description}」嗎？此操作將無法復原。`}
        error={state.error}
        onCancel={() => setIsConfirmationOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        open={isConfirmationOpen && !state.success}
        pending={isPending}
        title="確認要刪除此交易紀錄嗎？"
      />
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
  monthLabel,
  monthlyExpenseTotal,
  currency,
}: {
  accounts: DashboardAccount[];
  categories: Category[];
  transactions: DashboardTransaction[];
  viewOwnerId?: string | null;
  monthLabel: string;
  monthlyExpenseTotal: number;
  currency: string;
}) {
  const [isExpenseExpanded, setIsExpenseExpanded] = useState(true);
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
    <section className="border-y border-[#EFECE6] bg-white px-5 py-6 sm:px-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#8C827A]">家庭帳本</p>
          <h2 className="mt-1 font-semibold">{monthLabel}交易明細</h2>
          <p className="mt-2 text-sm text-[#8C827A]">
            {monthLabel}總支出{" "}
            <span className="font-mono font-semibold tabular-nums text-[#2C2623]">
              {formatMoney(monthlyExpenseTotal, currency)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isExpenseExpanded && (
            <>
              <select
                aria-label="CSV 匯出範圍"
                className="h-9 rounded-lg border border-[#EFECE6] bg-white px-2.5 text-xs text-[#8C827A] outline-none focus:border-[#B8976C]"
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
                  className="h-9 rounded-lg border border-[#EFECE6] bg-white px-2 text-xs text-[#8C827A] outline-none focus:border-[#B8976C]"
                  onChange={(event) => setExportMonth(event.target.value)}
                  type="month"
                  value={exportMonth}
                />
              )}
              <button
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[#EFECE6] px-3 text-xs font-semibold text-[#6B573F] transition hover:bg-[#E8DEC9] disabled:cursor-wait disabled:opacity-60"
                disabled={isExporting}
                onClick={downloadCsv}
                type="button"
              >
                <Download size={15} />
                {isExporting ? "準備中…" : "匯出 CSV"}
              </button>
              <ExcelExportButton />
            </>
          )}
          <button
            aria-controls="household-expense-details"
            aria-expanded={isExpenseExpanded}
            aria-label={isExpenseExpanded ? "收起家庭支出明細" : "展開家庭支出明細"}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#EFECE6] text-[#6B573F] transition-colors hover:bg-[#E8DEC9]"
            onClick={() => setIsExpenseExpanded((expanded) => !expanded)}
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={`transition-transform duration-300 ${isExpenseExpanded ? "rotate-180" : ""}`}
              size={18}
            />
          </button>
        </div>
      </div>

      <div
        aria-hidden={!isExpenseExpanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isExpenseExpanded ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
        id="household-expense-details"
        inert={!isExpenseExpanded}
      >
        <div className="min-h-0 overflow-hidden">
          {exportError && (
            <p aria-live="polite" className="mb-3 text-sm text-[#9f3e2e]" role="alert">
              {exportError}
            </p>
          )}

          {transactions.length ? (
            <div className="divide-y divide-[#E8DEC9]">
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
                          ? "bg-[#E8DEC9] text-[#6B573F]"
                          : isTransfer
                            ? "bg-[#E8DEC9] text-[#8C827A]"
                            : "bg-[#fff1e9] text-[#ab6942]"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {transaction.notes || transaction.description || (isTransfer ? "帳戶轉帳" : detail)}
                        {transaction.kind === "expense" &&
                          (transaction.scope === "shared" || transaction.scope === "paid_for_spouse") && (
                          <span className="ml-2 inline-flex rounded-full bg-[#E8DEC9] px-2 py-0.5 align-middle text-[10px] font-medium text-[#6B573F]">
                            {transaction.scope === "paid_for_spouse" ? "我代付" : "雙人"}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#8C827A]">
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
                        isIncome ? "text-[#6B573F]" : isTransfer ? "text-[#8C827A]" : "text-[#2C2623]"
                      }`}
                    >
                      {isIncome ? "+" : isTransfer ? "" : "−"}
                      {formatMoney(transaction.amount, transaction.currency)}
                    </p>
                    <button
                      aria-label="編輯交易"
                      className="grid size-9 shrink-0 place-items-center rounded-md text-[#8C827A] transition hover:bg-[#E8DEC9] hover:text-[#6B573F]"
                      onClick={() => setEditingTransaction(transaction)}
                      title="編輯交易"
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteTransactionForm
                      description={`${transaction.transaction_date} · ${detail} · ${formatMoney(transaction.amount, transaction.currency)}`}
                      transactionId={transaction.id}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#EFECE6] px-5 py-10 text-center text-sm text-[#8C827A]">
              尚無交易紀錄，使用「記一筆」開始記帳。
            </div>
          )}
        </div>
      </div>

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