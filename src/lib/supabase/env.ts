/**
 * Validates the Supabase env vars before they reach supabase-js. A missing
 * or malformed NEXT_PUBLIC_SUPABASE_URL (e.g. pasting the dashboard link
 * instead of the project API URL) otherwise surfaces as a confusing
 * downstream error from whatever host the bad URL happens to resolve to.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add it in your Vercel project's Environment " +
        "Variables (Project Settings > Environment Variables) and redeploy."
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL ("${url}") is not a valid URL. It should look like ` +
        "https://<project-ref>.supabase.co — copy it from Supabase Dashboard > Project " +
        "Settings > API, not the dashboard page URL itself."
    );
  }
  if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.includes("localhost")) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL ("${url}") doesn't look like a Supabase project API URL. ` +
        "It should look like https://<project-ref>.supabase.co — copy it from Supabase " +
        "Dashboard > Project Settings > API, not the dashboard page URL itself."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it in your Vercel project's Environment " +
        "Variables (Project Settings > Environment Variables) and redeploy."
    );
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in your Vercel project's Environment " +
        "Variables (Project Settings > Environment Variables) and redeploy."
    );
  }
  return key;
}
