"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getFinanceContext } from "@/lib/finance/context";
import type { Database } from "@/types/database";

export type InviteMemberState = {
  error: string | null;
  message: string | null;
};

const initialState: InviteMemberState = { error: null, message: null };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) return null;

  return createSupabaseClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function inviteHouseholdMemberAction(
  _previousState: InviteMemberState = initialState,
  formData: FormData,
): Promise<InviteMemberState> {
  void _previousState;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "請輸入有效的 Email 地址。", message: null };
  }

  const contextResult = await getFinanceContext();
  if (!contextResult.context) {
    return { error: contextResult.error, message: null };
  }

  const { supabase, user, householdId } = contextResult.context;
  if (user.email?.toLowerCase() === email) {
    return { error: "不能邀請自己的 Email。", message: null };
  }

  const admin = getAdminClient();
  if (!admin) {
    return {
      error: "伺服器缺少 SUPABASE_SECRET_KEY，無法確認受邀者帳號。",
      message: null,
    };
  }

  let invitedUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[members] Auth user lookup failed", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      return { error: `查詢受邀者帳號失敗：${error.message}`, message: null };
    }

    invitedUser =
      data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    if (invitedUser || data.users.length < 100) break;
  }

  const now = new Date().toISOString();
  if (invitedUser) {
    const displayName =
      (typeof invitedUser.user_metadata?.display_name === "string" &&
        invitedUser.user_metadata.display_name) ||
      email.split("@")[0];

    const { error: profileError } = await admin.from("users").upsert(
      { id: invitedUser.id, display_name: displayName },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileError) {
      console.error("[members] Invite profile upsert failed", profileError);
      return { error: `建立受邀者 Profile 失敗：${profileError.message}`, message: null };
    }

    const { error: memberError } = await admin.from("household_members").upsert(
      {
        household_id: householdId,
        user_id: invitedUser.id,
        role: "member",
        status: "active",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "household_id,user_id" },
    );
    if (memberError) {
      console.error("[members] Existing account household join failed", memberError);
      return { error: `加入家庭失敗：${memberError.message}`, message: null };
    }

    const { error: invitationError } = await admin.from("household_invitations").upsert(
      {
        household_id: householdId,
        email,
        invited_by: user.id,
        accepted_user_id: invitedUser.id,
        status: "accepted",
        updated_at: now,
      },
      { onConflict: "household_id,email" },
    );
    if (invitationError) {
      console.error("[members] Accepted invitation record failed", invitationError);
      return { error: `家庭已加入，但邀請紀錄寫入失敗：${invitationError.message}`, message: null };
    }

    revalidatePath("/");
    return { error: null, message: `${displayName} 已加入家庭。` };
  }

  const { error } = await supabase.from("household_invitations").upsert(
    {
      household_id: householdId,
      email,
      invited_by: user.id,
      accepted_user_id: null,
      status: "pending",
      updated_at: now,
    },
    { onConflict: "household_id,email" },
  );

  if (error) {
    console.error("[members] Pending invitation write failed", error);
    return { error: `建立邀請失敗：${error.message}`, message: null };
  }

  revalidatePath("/");
  return {
    error: null,
    message: "邀請已登記。請對方使用這個 Email 註冊或登入，系統會自動加入同一個家庭。",
  };
}