import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { HqRole } from "@/lib/types/database";

const VALID_ROLES: HqRole[] = [
  "admin",
  "verification_manager",
  "support",
  "content_editor",
  "developer",
];

export const dynamic = "force-dynamic";

function checkEnvVar(name: string, value: string | undefined) {
  if (!value) return { name, status: "MISSING" as const, detail: null };
  if (name === "NEXT_PUBLIC_SUPABASE_URL") {
    try {
      const url = new URL(value);
      const looksRight = url.hostname.endsWith(".supabase.co");
      return {
        name,
        status: looksRight ? ("OK" as const) : ("SUSPICIOUS" as const),
        detail: `hostname: ${url.hostname}${
          looksRight ? "" : " (expected something ending in .supabase.co)"
        }`,
      };
    } catch {
      return { name, status: "SUSPICIOUS" as const, detail: "not a valid URL" };
    }
  }
  return { name, status: "OK" as const, detail: `length: ${value.length}` };
}

export default async function DebugPage() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const debugCookie = cookieStore.get("hq_debug_cookie")?.value ?? null;

  const envChecks = [
    checkEnvVar("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    checkEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    checkEnvVar("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    checkEnvVar("HQ_SIGNUP_CODE", process.env.HQ_SIGNUP_CODE),
  ];

  let authState: string;
  let profileState: string;
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    authState = error
      ? `getUser() returned an error: ${error.message}`
      : user
        ? `Authenticated as ${user.email} (id: ${user.id})`
        : "No user — request has no valid session";

    if (!user) {
      profileState = "Skipped — no authenticated user.";
    } else {
      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (existingProfile) {
        profileState = `Found existing row — role: ${existingProfile.role}, email: ${existingProfile.email}`;
      } else {
        // Mirrors requireProfile()'s self-heal exactly, so this tells us
        // definitively whether that code path actually works against this
        // database, instead of guessing from the outside.
        const metadataRole = user.user_metadata?.role;
        const role: HqRole = VALID_ROLES.includes(metadataRole) ? metadataRole : "support";

        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email ?? "",
            full_name: user.user_metadata?.full_name ?? null,
            role,
          })
          .select("*")
          .single();

        if (createdProfile) {
          profileState = `No row existed — self-heal insert succeeded (role: ${createdProfile.role}). This should have worked in requireProfile() too.`;
        } else {
          profileState = `No row existed — self-heal insert FAILED. select error: ${
            selectError?.message ?? "none"
          } (code: ${selectError?.code ?? "n/a"}) | insert error: ${
            createError?.message ?? "unknown"
          } (code: ${createError?.code ?? "n/a"}, details: ${createError?.details ?? "n/a"}, hint: ${createError?.hint ?? "n/a"})`;
        }
      }
    }
  } catch (err) {
    authState = `Threw: ${err instanceof Error ? err.message : String(err)}`;
    profileState = "Skipped — auth check threw before profile check could run.";
  }

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>FurFinds HQ — Diagnostics</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Remove this page once the login issue is resolved — it&apos;s a temporary debug tool.
      </p>

      <Section title="Deployment">
        <Row label="VERCEL_GIT_COMMIT_SHA" value={process.env.VERCEL_GIT_COMMIT_SHA ?? "not set (not running on Vercel, or var unavailable)"} />
        <Row label="VERCEL_ENV" value={process.env.VERCEL_ENV ?? "not set"} />
        <Row label="NODE_ENV" value={process.env.NODE_ENV} />
      </Section>

      <Section title="Environment variables (presence/format only, no secret values shown)">
        {envChecks.map((c) => (
          <Row key={c.name} label={c.name} value={`${c.status}${c.detail ? ` — ${c.detail}` : ""}`} />
        ))}
      </Section>

      <Section title="Current auth state (server-side, this request)">
        <Row label="Result" value={authState} />
      </Section>

      <Section title="profiles table check (mirrors requireProfile()'s exact logic)">
        <Row label="Result" value={profileState} />
      </Section>

      <Section title="Cookies visible to the server on this request">
        {allCookies.length === 0 ? (
          <p>No cookies at all were sent with this request.</p>
        ) : (
          <ul>
            {allCookies.map((c) => (
              <li key={c.name}>
                {c.name} <span style={{ color: "#666" }}>({c.value.length} chars)</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cookie round-trip test">
        <Row
          label="hq_debug_cookie (from a previous visit to the test endpoint)"
          value={debugCookie ?? "not present"}
        />
        <p>
          Open{" "}
          <a href="/api/debug/cookie-test" style={{ color: "#395EA1" }}>
            /api/debug/cookie-test
          </a>{" "}
          — it returns JSON. Note the <code>newValueJustSet</code> value, then reload this{" "}
          <a href="/debug" style={{ color: "#395EA1" }}>
            /debug
          </a>{" "}
          page. If &quot;hq_debug_cookie&quot; above still says &quot;not present&quot;, or never
          matches what the endpoint set, cookies are not persisting on this domain/browser at
          all — that&apos;s a browser, network, or CDN issue unrelated to our Supabase code.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #ddd", paddingTop: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ margin: "4px 0", fontSize: 13 }}>
      <strong>{label}:</strong> {value}
    </p>
  );
}
