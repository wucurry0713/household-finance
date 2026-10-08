import Link from "next/link";
import { Wallet } from "lucide-react";

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
    <header className="border-b border-[#dce5de] bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link className="flex shrink-0 items-center gap-2.5" href="/">
          <span className="grid size-9 place-items-center rounded-lg bg-[#18392f] text-[#c9ed78]">
            <Wallet size={19} />
          </span>
          <span className="text-sm font-semibold tracking-[0.08em]">TANDEM</span>
        </Link>
        <nav aria-label="主要導覽" className="flex items-center gap-1">
          <Link
            aria-current={currentPage === "dashboard" ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              currentPage === "dashboard"
                ? "bg-[#edf5ef] text-[#1d6048]"
                : "text-[#60736a] hover:bg-[#edf2ee]"
            }`}
            href={`/?month=${month}`}
          >
            總覽
          </Link>
          <Link
            aria-current={currentPage === "analytics" ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              currentPage === "analytics"
                ? "bg-[#edf5ef] text-[#1d6048]"
                : "text-[#60736a] hover:bg-[#edf2ee]"
            }`}
            href={`/analytics?month=${month}`}
          >
            分析
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className="hidden max-w-36 truncate text-sm text-[#60736a] sm:inline">
            {displayName}
          </span>
          <form action={signOutAction}>
            <button className="rounded-md px-3 py-2 text-sm font-medium text-[#52665d] transition hover:bg-[#edf2ee] hover:text-[#18392f]">
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
