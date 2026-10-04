"use server";

import { redirect } from "next/navigation";

import { ensureUserProfileAndHousehold } from "@/lib/supabase/provision";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  message: string | null;
};

const invalidForm: AuthFormState = {
  error: "請確認 Email 與密碼欄位正確。",
  message: null,
};

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return invalidForm;

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("[auth:sign-in] Failed to create Supabase server client", error);
    return {
      error: error instanceof Error ? error.message : "無法初始化 Supabase client。",
      message: null,
    };
  }

  let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    authResult = await supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    console.error("[Supabase Auth] signInWithPassword threw an exception", error);
    return {
      error: error instanceof Error ? error.message : "Supabase 登入請求發生未知錯誤。",
      message: null,
    };
  }

  const { data, error } = authResult;

  if (error || !data.user) {
    if (error) {
      console.error("[Supabase Auth] signInWithPassword returned AuthError", error);
      console.error("[Supabase Auth] signInWithPassword error details", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });
    }
    return {
      error: error?.message ?? "Supabase 登入成功回應中沒有 user。",
      message: null,
    };
  }

  const provision = await ensureUserProfileAndHousehold(supabase, data.user);
  if (provision.error) return { error: provision.error, message: null };

  redirect("/");
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!displayName || !email || password.length < 8) return invalidForm;

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("[auth:sign-up] Failed to create Supabase server client", error);
    return {
      error: error instanceof Error ? error.message : "無法初始化 Supabase client。",
      message: null,
    };
  }

  let authResult: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    authResult = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
  } catch (error) {
    console.error("[Supabase Auth] signUp threw an exception", error);
    return {
      error: error instanceof Error ? error.message : "Supabase 註冊請求發生未知錯誤。",
      message: null,
    };
  }

  const { data, error } = authResult;

  if (error) {
    console.error("[Supabase Auth] signUp returned AuthError", error);
    console.error("[Supabase Auth] signUp error details", {
      name: error.name,
      code: error.code,
      message: error.message,
      status: error.status,
    });
    return { error: error.message, message: null };
  }

  if (!data.session || !data.user) {
    return {
      error: null,
      message: "註冊完成。請先至信箱驗證 Email，驗證後登入即可建立個人資料與家庭空間。",
    };
  }

  const provision = await ensureUserProfileAndHousehold(supabase, data.user);
  if (provision.error) return { error: provision.error, message: null };

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}