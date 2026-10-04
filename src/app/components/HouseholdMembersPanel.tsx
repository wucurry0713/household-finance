"use client";

import { useActionState } from "react";
import { MailPlus, UserRound, Users } from "lucide-react";

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
    <section className="border-y border-[#dce5de] bg-white px-5 py-6 sm:px-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ec] text-[#237457]">
          <Users size={19} />
        </span>
        <div>
          <h2 className="font-semibold">家庭成員</h2>
          <p className="mt-1 text-sm text-[#718078]">家庭資料由成員共同管理</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {members.map((member) => (
          <div className="flex items-center gap-3" key={member.userId}>
            <span className="grid size-9 place-items-center rounded-full bg-[#edf2ee] text-[#557167]">
              <UserRound size={17} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {member.displayName}
              {member.userId === currentUserId && (
                <span className="ml-2 text-xs font-normal text-[#829088]">我</span>
              )}
            </span>
            <span className="text-xs text-[#829088]">
              {member.role === "owner" ? "管理者" : "成員"}
            </span>
          </div>
        ))}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="mt-5 border-t border-[#edf1ed] pt-4">
          <p className="mb-3 text-xs font-medium text-[#829088]">等待註冊或登入</p>
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <p className="truncate text-sm text-[#65766d]" key={invitation.id}>
                {invitation.email}
              </p>
            ))}
          </div>
        </div>
      )}

      <form action={formAction} className="mt-5 border-t border-[#edf1ed] pt-4">
        <label className="mb-2 block text-sm font-medium" htmlFor="invite-member-email">
          邀請另一位成員
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <MailPlus
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829088]"
              size={17}
            />
            <input
              autoComplete="email"
              className="h-10 w-full rounded-lg border border-[#d6dfd9] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
              id="invite-member-email"
              name="email"
              placeholder="name@example.com"
              required
              type="email"
            />
          </div>
          <button
            className="h-10 shrink-0 rounded-lg bg-[#1d6048] px-3 text-sm font-semibold text-white transition hover:bg-[#164c39] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "處理中…" : "邀請"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#829088]">
          已有帳號會直接加入；尚未註冊者使用此 Email 登入後會自動加入。
        </p>
        {state.error && (
          <p aria-live="polite" className="mt-3 text-sm text-[#9f3e2e]" role="alert">
            {state.error}
          </p>
        )}
        {state.message && (
          <p aria-live="polite" className="mt-3 text-sm text-[#285943]" role="status">
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}