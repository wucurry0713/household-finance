"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";

import { currentMonthKey, monthLabel, shiftMonthKey } from "@/lib/finance/month";

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const thisMonth = currentMonthKey();

  function selectMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <section
      aria-label="選擇帳務月份"
      className="mb-7 flex flex-wrap items-center gap-2 rounded-xl border border-[#dce5de] bg-white p-3"
    >
      <button
        aria-label="上個月"
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#dce5de] text-[#52665d] transition hover:bg-[#edf5ef] disabled:opacity-50"
        disabled={isPending}
        onClick={() => selectMonth(shiftMonthKey(month, -1))}
        type="button"
      >
        <ArrowLeft size={18} />
      </button>
      <label className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <CalendarDays aria-hidden="true" className="shrink-0 text-[#237457]" size={18} />
        <span className="sr-only">選擇年份與月份</span>
        <input
          aria-label="選擇年份與月份"
          className="min-w-0 rounded-lg border-0 bg-transparent px-1 py-2 text-center text-sm font-semibold text-[#18392f] outline-none focus:ring-2 focus:ring-[#237457]/20"
          disabled={isPending}
          onChange={(event) => {
            if (event.target.value) selectMonth(event.target.value);
          }}
          type="month"
          value={month}
        />
      </label>
      <button
        aria-label="下個月"
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#dce5de] text-[#52665d] transition hover:bg-[#edf5ef] disabled:opacity-50"
        disabled={isPending}
        onClick={() => selectMonth(shiftMonthKey(month, 1))}
        type="button"
      >
        <ArrowRight size={18} />
      </button>
      {month !== thisMonth && (
        <button
          className="h-10 rounded-lg px-3 text-xs font-semibold text-[#1d6048] transition hover:bg-[#edf5ef] disabled:opacity-50"
          disabled={isPending}
          onClick={() => selectMonth(thisMonth)}
          type="button"
        >
          回到本月
        </button>
      )}
      <p aria-live="polite" className="w-full text-center text-xs text-[#718078]">
        {isPending ? "正在載入月份資料…" : monthLabel(month)}
      </p>
    </section>
  );
}
