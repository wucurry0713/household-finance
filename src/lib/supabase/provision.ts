import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type DatabaseFailure = {
  stage: string;
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type ProvisionResult =
  | { householdId: string; error: null }
  | { householdId: null; error: string };

type AttemptResult =
  | { householdId: string; failure: null }
  | { householdId: null; failure: DatabaseFailure };

function toFailure(
  stage: string,
  error: { code?: string; message: string; details?: string | null; hint?: string | null },
): AttemptResult {
  return {
    householdId: null,
    failure: {
      stage,
      code: error.code,
      message: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
    },
  };
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !secretKey) return null;

  return createSupabaseClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function describeFailure(failure: DatabaseFailure) {
  const parts = [failure.message];
  if (failure.code) parts.push(`SQLSTATE ${failure.code}`);
  if (failure.details) parts.push(`details: ${failure.details}`);
  if (failure.hint) parts.push(`hint: ${failure.hint}`);
  return `${failure.stage}：${parts.join("；")}`;
}

function logFailure(userId: string, failure: DatabaseFailure, attempt: string) {
  console.error("[auth:household-initialization] Database operation failed", {
    attempt,
    userId,
    stage: failure.stage,
    code: failure.code,
    message: failure.message,
    details: failure.details,
    hint: failure.hint,
  });
}

function logSuccess(userId: string, stage: string, details: Record<string, string>) {
  console.info("[auth:household-initialization] Database operation succeeded", {
    userId,
    stage,
    ...details,
  });
}

async function claimPendingInvitation(user: User): Promise<AttemptResult | null> {
  if (!user.email) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const email = user.email.trim().toLowerCase();
  const { data: invitation, error: invitationReadError } = await admin
    .from("household_invitations")
    .select("id, household_id, invited_by")
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (invitationReadError) {
    if (invitationReadError.code === "42P01" || invitationReadError.code === "PGRST205") {
      console.warn("[auth:household-invitation] Invitation migration is not applied yet");
      return null;
    }
    const failure = toFailure("查詢待接受家庭邀請", invitationReadError);
    if (failure.failure !== null) logFailure(user.id, failure.failure, "invitation-read");
    return failure;
  }

  if (!invitation) return null;

  const now = new Date().toISOString();
  const { error: memberError } = await admin.from("household_members").upsert(
    {
      household_id: invitation.household_id,
      user_id: user.id,
      role: "member",
      status: "active",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "household_id,user_id" },
  );

  if (memberError) {
    const failure = toFailure("接受邀請並加入 Household", memberError);
    if (failure.failure !== null) logFailure(user.id, failure.failure, "invitation-membership");
    return failure;
  }

  const { error: acceptError } = await admin
    .from("household_invitations")
    .update({
      status: "accepted",
      accepted_user_id: user.id,
      updated_at: now,
    })
    .eq("id", invitation.id);

  if (acceptError) {
    const failure = toFailure("更新邀請接受狀態", acceptError);
    if (failure.failure !== null) logFailure(user.id, failure.failure, "invitation-accept");
    return failure;
  }

  logSuccess(user.id, "Pending household invitation claimed", {
    householdId: invitation.household_id,
  });
  return { householdId: invitation.household_id, failure: null };
}

async function initializeWithClient(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<AttemptResult> {
  const metadataName = user.user_metadata.display_name;
  const displayName =
    (typeof metadataName === "string" && metadataName.trim()) ||
    user.email?.split("@")[0] ||
    "家庭成員";
  const now = new Date().toISOString();

  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: user.id,
      display_name: displayName,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (profileError) {
    logFailure(user.id, toFailure("建立或檢查 Profile", profileError).failure!, "profile");
    return toFailure("建立或檢查 Profile", profileError);
  }
  logSuccess(user.id, "Profile ready", { table: "users", profileId: user.id });

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    logFailure(user.id, toFailure("查詢家庭成員資格", membershipError).failure!, "membership-read");
    return toFailure("查詢家庭成員資格", membershipError);
  }

  if (membership) {
    logSuccess(user.id, "Existing household membership found", {
      householdId: membership.household_id,
    });
    return { householdId: membership.household_id, failure: null };
  }

  const invitationClaim = await claimPendingInvitation(user);
  if (invitationClaim?.failure) return invitationClaim;
  if (invitationClaim?.householdId) return invitationClaim;

  const { data: existingHousehold, error: existingHouseholdError } = await supabase
    .from("households")
    .select("id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingHouseholdError) {
    logFailure(
      user.id,
      toFailure("查詢既有 Household", existingHouseholdError).failure!,
      "household-read",
    );
    return toFailure("查詢既有 Household", existingHouseholdError);
  }

  let householdId = existingHousehold?.id;
  let createdHousehold = false;

  if (householdId) {
    logSuccess(user.id, "Reusing existing household", { householdId });
  } else {
    householdId = crypto.randomUUID();
    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({
        id: householdId,
        name: `${displayName} 的家庭`,
        base_currency: "TWD",
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (householdError) {
      logFailure(user.id, toFailure("建立 Household", householdError).failure!, "household-insert");
      return toFailure("建立 Household", householdError);
    }

    if (!household?.id) {
      const failure = toFailure("建立 Household", {
        message: "Insert 未回傳 Household ID。",
      });
      if (failure.failure !== null) logFailure(user.id, failure.failure, "household-insert");
      return failure;
    }

    householdId = household.id;
    createdHousehold = true;
    logSuccess(user.id, "Household created", { householdId });
  }

  const { data: createdMembership, error: memberError } = await supabase
    .from("household_members")
    .upsert(
      {
        household_id: householdId,
        user_id: user.id,
        role: "owner",
        status: "active",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "household_id,user_id" },
    )
    .select("household_id")
    .single();

  if (memberError) {
    logFailure(user.id, toFailure("建立 Household membership", memberError).failure!, "membership-upsert");
    if (createdHousehold) {
      const { error: rollbackError } = await supabase
        .from("households")
        .delete()
        .eq("id", householdId);

      if (rollbackError) {
        const rollbackFailure = toFailure(
          "清理未完成初始化的 Household",
          rollbackError,
        );
        if (rollbackFailure.failure !== null) {
          logFailure(user.id, rollbackFailure.failure, "rollback");
        }
      }
    }

    return toFailure("將使用者加入 Household", memberError);
  }

  if (!createdMembership?.household_id) {
    const failure = toFailure("建立 Household membership", {
      message: "Upsert 未回傳 household_id。",
    });
    if (failure.failure !== null) logFailure(user.id, failure.failure, "membership-upsert");
    return failure;
  }

  logSuccess(user.id, "Household membership ready", {
    householdId: createdMembership.household_id,
  });
  return { householdId: createdMembership.household_id, failure: null };
}

export async function ensureUserProfileAndHousehold(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<ProvisionResult> {
  const userClientResult = await initializeWithClient(supabase, user);
  if (userClientResult.failure === null) {
    return { householdId: userClientResult.householdId, error: null };
  }

  logFailure(user.id, userClientResult.failure, "authenticated-client");
  console.warn(
    "[auth:household-initialization] Retrying with server-side admin client",
    { userId: user.id, stage: userClientResult.failure.stage },
  );

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      householdId: null,
      error: `${describeFailure(userClientResult.failure)}。伺服器尚未設定 SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_SECRET_KEY），無法使用管理權限完成初始化。`,
    };
  }

  const adminResult = await initializeWithClient(adminClient, user);
  if (adminResult.failure !== null) {
    logFailure(user.id, adminResult.failure, "service-role-client");
    return {
      householdId: null,
      error: `一般登入權限初始化失敗：${describeFailure(userClientResult.failure)}。Service Role 初始化也失敗：${describeFailure(adminResult.failure)}`,
    };
  }

  logSuccess(user.id, "Initialization completed with admin client", {
    householdId: adminResult.householdId,
  });
  return { householdId: adminResult.householdId, error: null };
}