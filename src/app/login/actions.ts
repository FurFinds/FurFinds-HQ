"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_REDIRECT = "/hq/dashboard";

/** Only follow redirectTo if it's a safe, internal HQ path — otherwise fall back to the dashboard. */
function resolveRedirect(rawRedirect: string | null | undefined): string {
  if (
    !rawRedirect ||
    !rawRedirect.startsWith("/") ||
    rawRedirect.startsWith("//") ||
    rawRedirect === "/login" ||
    rawRedirect === "/signup"
  ) {
    return DEFAULT_REDIRECT;
  }
  return rawRedirect;
}

interface SignInParams {
  email: string;
  password: string;
  redirectTo?: string | null;
}

/**
 * Signs in server-side so the session cookie is written and the redirect
 * happen in the same response — a client-side signInWithPassword() followed
 * by a client navigation left a window where the next request could arrive
 * before the browser had durably applied the new cookie.
 */
export async function signIn({ email, password, redirectTo }: SignInParams) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(resolveRedirect(redirectTo));
}
