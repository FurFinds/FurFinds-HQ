import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// Auth decisions (redirect-to-login, redirect-to-dashboard, cookie refresh)
// must never be cached by Vercel's edge network or any intermediate CDN —
// a cached redirect would get served to every visitor regardless of their
// actual session state. @supabase/ssr's server storage passes these same
// headers to setAll for this exact reason; we also apply them defensively
// to every response this function returns.
const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function withNoStore(res: NextResponse): NextResponse {
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
  return res;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  let refreshedCookies: CookieToSet[] = [];

  // If Supabase env vars are missing/malformed, don't let the whole edge
  // function crash on every request — fail safe (treat as unauthenticated)
  // so public pages like /login stay reachable and show a clear error
  // instead of a blank/broken deployment.
  let user: User | null = null;
  try {
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          refreshedCookies = cookiesToSet;
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error("Supabase auth check failed in middleware:", err);
  }

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    const redirectResponse = NextResponse.redirect(url);
    refreshedCookies.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set(name, value, options)
    );
    return withNoStore(redirectResponse);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hq/dashboard";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    refreshedCookies.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set(name, value, options)
    );
    return withNoStore(redirectResponse);
  }

  return withNoStore(response);
}
