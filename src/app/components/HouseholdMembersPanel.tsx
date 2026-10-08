"use client";

import { useActionState } from "react";
import { ChevronDown, MailPlus, UserRound, Users } from "lucide-react";

import {
  inviteHouseholdMemberAction,
  type InviteMemberState,
} from "@/app/actions/members";
import type { DashboardMember } from "@/lib/finance/dashboard";

const initialState: InviteMemberState = { error: null, message: null };

export function HouseholdMembersPanel({
  currentUserId,
  members,
  pendingInvitations,
}: {
  currentUserId: string;
  members: DashboardMember[];
  pendingInvitations: { id: string; email: string; created_at: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    inviteHouseholdMemberAction,
    initialState,
  );

  return (
    <details className="group border-y border-[#EFECE6] bg-white px-5 py-6 sm:px-7">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#E8DEC9] text-[#6B573F]">
            <Users size={19} />
          </span>
          <span>
            <span className="block font-semibold">家庭成員</span>
            <span className="mt-1 block text-sm text-[#8C827A]">家庭資料由成員共同管理</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-[#8C827A] transition-transform group-open:rotate-180"
          size={18}
        />
      </summary>

      <div className="pt-5">
      <div className="space-y-3">
        {members.map((member) => (
          <div className="flex items-center gap-3" key={member.userId}>
            <span className="grid size-9 place-items-center rounded-full bg-[#E8DEC9] text-[#8C827A]">
              <UserRound size={17} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {member.displayName}
              {member.userId === currentUserId && (
                <span className="ml-2 text-xs font-normal text-[#8C827A]">我</span>
              )}
            </span>
            <span className="text-xs text-[#8C827A]">
              {member.role === "owner" ? "管理者" : "成員"}
            </span>
          </div>
        ))}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="mt-5 border-t border-[#EFECE6] pt-4">
          <p className="mb-3 text-xs font-medium text-[#8C827A]">等待註冊或登入</p>
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <p className="truncate text-sm text-[#8C827A]" key={invitation.id}>
                {invitation.email}
              </p>
            ))}
          </div>
        </div>
      )}

      <form action={formAction} className="mt-5 border-t border-[#EFECE6] pt-4">
        <label className="mb-2 block text-sm font-medium" htmlFor="invite-member-email">
          邀請另一位成員
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <MailPlus
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]"
              size={17}
            />
            <input
              autoComplete="email"
              className="h-10 w-full rounded-lg border border-[#EFECE6] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#B8976C] focus:ring-2 focus:ring-[#B8976C]/15"
              id="invite-member-email"
              name="email"
              placeholder="name@example.com"
              required
              type="email"
            />
          </div>
          <button
            className="h-10 shrink-0 rounded-lg bg-[#B8976C] px-3 text-sm font-semibold text-white transition hover:bg-[#A3835B] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "處理中…" : "邀請"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#8C827A]">
          已有帳號會直接加入；尚未註冊者使用此 Email 登入後會自動加入。
        </p>
        {state.error && (
          <p aria-live="polite" className="mt-3 text-sm text-[#9f3e2e]" role="alert">
            {state.error}
          </p>
        )}
        {state.message && (
          <p aria-live="polite" className="mt-3 text-sm text-[#6B573F]" role="status">
            {state.message}
          </p>
        )}
      </form>
      </div>
    </details>
  );
}