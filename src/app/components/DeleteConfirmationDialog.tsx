"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export function DeleteConfirmationDialog({
  open,
  title,
  description,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#2C2623]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-[#EFECE6] bg-white p-5 shadow-2xl sm:p-6"
        role="alertdialog"
      >
        <span className="grid size-11 place-items-center rounded-full bg-[#fff0ed] text-[#a14131]">
          <AlertTriangle aria-hidden="true" size={21} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#2C2623]" id="delete-confirmation-title">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#8C827A]">{description}</p>
        {error && (
          <p aria-live="polite" className="mt-3 text-sm text-[#9f3e2e]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            autoFocus
            className="h-10 rounded-lg border border-[#EFECE6] px-4 text-sm font-medium text-[#6B573F] transition hover:bg-[#E8DEC9] disabled:opacity-50"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="h-10 rounded-lg bg-[#A14131] px-4 text-sm font-semibold text-white transition hover:bg-[#873728] disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </section>
    </div>
  );
}
