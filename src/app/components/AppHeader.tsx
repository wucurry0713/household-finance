import Link from "next/link";

import { BrandMark } from "@/app/components/BrandMark";
import { signOutAction } from "@/app/login/actions";

export function AppHeader({
  displayName,
  currentPage,
  month,
}: {
  displayName: string;
  currentPage: "dashboard" | "analytics";
  month: string;
}) {
  return (
    <header className="border-b border-[#EFECE6] bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link className="flex shrink-0 items-center gap-2.5" href="/">
          <BrandMark />
          <span className="text-base font-semibold tracking-[0.04em] text-[#2C2623]">Ledgero</span>
        </Link>
        <nav aria-label="主要導覽" className="flex items-center gap-1">
          <Link
            aria-current={currentPage === "dashboard" ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              currentPage === "dashboard"
                ? "bg-[#B8976C] text-white"
                : "text-[#8C827A] hover:bg-[#F3EEE5]"
            }`}
            href={`/?month=${month}`}
          >
            總覽
          </Link>
          <Link
            aria-current={currentPage === "analytics" ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              currentPage === "analytics"
                ? "bg-[#B8976C] text-white"
                : "text-[#8C827A] hover:bg-[#F3EEE5]"
            }`}
            href={`/analytics?month=${month}`}
          >
            分析
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className="hidden max-w-36 truncate text-sm text-[#8C827A] sm:inline">
            {displayName}
          </span>
          <form action={signOutAction}>
            <button className="rounded-md px-3 py-2 text-sm font-medium text-[#6B573F] transition hover:bg-[#F3EEE5] hover:text-[#2C2623]">
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
