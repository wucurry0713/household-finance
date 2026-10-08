"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

export function ExcelExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportWorkbook() {
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/exports/finance");
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "Excel 匯出失敗，請稍後再試。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Tandem-家庭財務報表-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Excel 匯出失敗，請稍後再試。";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <button
        className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1d6048] px-3 text-xs font-semibold text-white transition hover:bg-[#164c39] disabled:cursor-wait disabled:opacity-60"
        disabled={isExporting}
        onClick={exportWorkbook}
        type="button"
      >
        <FileSpreadsheet size={15} />
        {isExporting ? "準備中…" : "匯出完整 Excel"}
      </button>
      {error && (
        <p aria-live="polite" className="mt-2 text-xs text-[#9f3e2e]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
