import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  console.log("[Supabase Config Test]", {
    url: supabaseUrl,
    hasPubKey: !!publishableKey,
    hasAnonKey: !!anonKey,
  });

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Supabase public environment variables are missing or empty. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, publishableKey, {
    global: { headers: { apikey: publishableKey } },
    cookieOptions: {
      maxAge: 400 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}