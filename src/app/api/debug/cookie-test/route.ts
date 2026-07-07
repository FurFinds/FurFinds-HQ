import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "hq_debug_cookie";

/**
 * Minimal cookie round-trip check, independent of Supabase entirely.
 * Visit twice: the first response has receivedPreviousValue: null, the
 * second should echo back the value this route set on the first visit.
 * If it never does — in a fresh browser/incognito, after confirming this
 * exact URL is reachable — cookies are being dropped somewhere between
 * this response and the next request (CDN caching, a proxy stripping
 * Set-Cookie, browser cookie settings), which is unrelated to our
 * Supabase auth code.
 */
export async function GET(request: Request) {
  const cookieStore = cookies();
  const previous = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const newValue = `set-at-${Date.now()}`;

  const response = NextResponse.json(
    {
      receivedPreviousValue: previous,
      newValueJustSet: newValue,
      requestUrl: request.url,
      allCookieNamesOnThisRequest: cookieStore.getAll().map((c) => c.name),
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set(COOKIE_NAME, newValue, {
    path: "/",
    sameSite: "lax",
    maxAge: 300,
  });

  return response;
}
