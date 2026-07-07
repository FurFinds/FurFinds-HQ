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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

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
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hq/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
