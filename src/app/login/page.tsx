"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  Wallet,
} from "lucide-react";

import { signInAction, signUpAction } from "@/app/login/actions";

type AuthMode = "login" | "signup";

const initialState = { error: null, message: null };

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginFormAction, isLoggingIn] = useActionState(
    signInAction,
    initialState,
  );
  const [signupState, signupFormAction, isSigningUp] = useActionState(
    signUpAction,
    initialState,
  );
  const isSignup = mode === "signup";
  const state = isSignup ? signupState : loginState;
  const isPending = isSignup ? isSigningUp : isLoggingIn;

  return (
    <main className="min-h-screen bg-[#f4f7f3] text-[#14251f] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#18392f] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-28 -top-32 size-[26rem] rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-12 size-[19rem] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#c9ed78] text-[#18392f]">
            <Wallet size={21} strokeWidth={2.2} />
          </span>
          <span className="text-sm font-semibold tracking-[0.08em]">TANDEM</span>
        </div>

        <div className="relative max-w-xl pb-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ed78]">
            家庭財務，一起掌握
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.13] tracking-[-0.035em] xl:text-6xl">
            讓每一筆日常，
            <br />
            都有共同的方向。
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">
            從今天的收支，到一家人的資產，清楚記錄，也一起看見累積。
          </p>

          <div className="mt-12 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60">家庭資產總覽</p>
                <p className="mt-2 text-2xl font-semibold">一起累積的每一步</p>
              </div>
              <span className="grid size-11 place-items-center rounded-full bg-[#c9ed78] text-[#18392f]">
                <ArrowRight size={20} />
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/10 p-3.5">
                <p className="text-xs text-white/60">日常收支</p>
                <p className="mt-2 text-sm font-medium">每筆都有歸屬</p>
              </div>
              <div className="rounded-xl bg-black/10 p-3.5">
                <p className="text-xs text-white/60">共同目標</p>
                <p className="mt-2 text-sm font-medium">一起看見進度</p>
              </div>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-white/45">Tandem · 家庭記帳與資產管理</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#18392f] text-[#c9ed78]">
              <Wallet size={21} />
            </span>
            <span className="text-sm font-semibold tracking-[0.08em]">TANDEM</span>
          </div>

          <div className="mb-8">
            <p className="text-sm font-medium text-[#557167]">
              {isSignup ? "開始建立你們的家庭空間" : "歡迎回來"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
              {isSignup ? "建立帳戶" : "登入帳戶"}
            </h2>
          </div>

          <div className="mb-7 grid grid-cols-2 border-b border-[#d9e2dc]">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`border-b-2 px-2 pb-3 text-sm font-medium transition-colors ${
                !isSignup
                  ? "border-[#237457] text-[#18392f]"
                  : "border-transparent text-[#75847d] hover:text-[#18392f]"
              }`}
            >
              登入
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`border-b-2 px-2 pb-3 text-sm font-medium transition-colors ${
                isSignup
                  ? "border-[#237457] text-[#18392f]"
                  : "border-transparent text-[#75847d] hover:text-[#18392f]"
              }`}
            >
              建立帳戶
            </button>
          </div>

          <form
            action={isSignup ? signupFormAction : loginFormAction}
            className="space-y-5"
          >
            {isSignup && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium">顯示名稱</span>
                <span className="relative block">
                  <UserRound
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718078]"
                    size={18}
                  />
                  <input
                    autoComplete="nickname"
                    className="h-12 w-full rounded-lg border border-[#d6dfd9] bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                    name="display_name"
                    placeholder="例如：雅婷"
                    required
                    maxLength={80}
                  />
                </span>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <span className="relative block">
                <Mail
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718078]"
                  size={18}
                />
                <input
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-[#d6dfd9] bg-white pl-11 pr-4 text-sm outline-none transition focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                  name="email"
                  placeholder="name@example.com"
                  required
                  type="email"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">密碼</span>
              <span className="relative block">
                <LockKeyhole
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718078]"
                  size={18}
                />
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="h-12 w-full rounded-lg border border-[#d6dfd9] bg-white pl-11 pr-12 text-sm outline-none transition focus:border-[#237457] focus:ring-2 focus:ring-[#237457]/15"
                  minLength={8}
                  name="password"
                  placeholder={isSignup ? "至少 8 個字元" : "輸入密碼"}
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                  className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-[#718078] hover:bg-[#edf2ee]"
                  onClick={() => setShowPassword((visible) => !visible)}
                  title={showPassword ? "隱藏密碼" : "顯示密碼"}
                  type="button"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {state.error && (
              <p
                aria-live="polite"
                role="alert"
                className="rounded-lg bg-[#fff0ed] px-4 py-3 text-sm text-[#9f3e2e]"
              >
                {state.error}
              </p>
            )}
            {state.message && (
              <p
                aria-live="polite"
                className="rounded-lg bg-[#eaf4ed] px-4 py-3 text-sm leading-6 text-[#285943]"
              >
                {state.message}
              </p>
            )}

            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1d6048] px-5 text-sm font-semibold text-white transition hover:bg-[#164c39] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "請稍候…" : isSignup ? "建立帳戶" : "登入"}
              {!isPending && <ArrowRight aria-hidden="true" size={17} />}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-[#77857e]">
            建立帳戶即表示你同意妥善保管登入資訊，並與家庭成員共同管理資料。
          </p>
        </div>
      </section>
    </main>
  );
}