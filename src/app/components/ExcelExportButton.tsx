"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { ExpenseScopeFilter } from "@/lib/finance/expense-scope";

export function ExcelExportButton({
  month,
  expenseScope = "all",
  ownerId,
  period = "month",
}: {
  month?: string;
  expenseScope?: ExpenseScopeFilter;
  ownerId?: string | null;
  period?: "month" | "six_months" | "year";
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportReport(format: "xlsx" | "csv") {
    setIsExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format, expenseScope, period });
      if (month) params.set("month", month);
      if (ownerId) params.set("ownerId", ownerId);
      const response = await fetch(`/api/exports/finance?${params.toString()}`);
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "財務報表匯出失敗，請稍後再試。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Ledgero-家庭財務報表-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "財務報表匯出失敗，請稍後再試。";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="flex h-9 items-center gap-1.5 rounded-lg bg-[#B8976C] px-3 text-xs font-semibold text-white transition hover:bg-[#A3835B] disabled:cursor-wait disabled:opacity-60"
        disabled={isExporting}
        onClick={() => void exportReport("xlsx")}
        type="button"
      >
        <FileSpreadsheet size={15} />
        {isExporting ? "準備中…" : "完整 Excel"}
      </button>
      <button
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#EFECE6] bg-white px-3 text-xs font-semibold text-[#6B573F] transition hover:bg-[#E8DEC9] disabled:cursor-wait disabled:opacity-60"
        disabled={isExporting}
        onClick={() => void exportReport("csv")}
        type="button"
      >
        {isExporting ? "準備中…" : "完整 CSV"}
      </button>
      {error && (
        <p aria-live="polite" className="mt-2 text-xs text-[#9f3e2e]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
