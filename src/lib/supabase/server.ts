import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (err) {
          // next/headers only allows mutating cookies from a Server Action
          // or Route Handler — calling this from a Server Component throws
          // by design, and middleware refreshes the session in that case,
          // so that specific error is expected and safe to ignore. Anything
          // else (e.g. a genuinely malformed cookie option) is logged so it
          // doesn't fail completely silently.
          if (!(err instanceof Error) || !err.message.includes("Cookies can only be modified")) {
            console.error("Unexpected error setting Supabase auth cookies:", err);
          }
        }
      },
    },
  });
}
