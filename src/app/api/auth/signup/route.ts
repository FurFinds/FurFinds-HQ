import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HqRole } from "@/lib/types/database";

const VALID_ROLES: HqRole[] = [
  "admin",
  "verification_manager",
  "support",
  "content_editor",
  "developer",
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { email, password, fullName, role, accessCode } = body ?? {};

    const expectedCode = process.env.HQ_SIGNUP_CODE;
    if (!expectedCode || accessCode !== expectedCode) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const resolvedRole: HqRole = VALID_ROLES.includes(role) ? role : "support";

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: typeof fullName === "string" ? fullName : null,
      },
      // app_metadata (not user_metadata) carries the role, since only this
      // service-role admin call can set it — the DB trigger that
      // provisions the profiles row trusts app_metadata specifically so a
      // client can't grant itself a role via a plain signUp() call.
      app_metadata: {
        role: resolvedRole,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  } catch (err) {
    // Surface a clear JSON error (e.g. missing/invalid Supabase env vars)
    // instead of letting an unhandled exception return a non-JSON 500 that
    // the client can't parse, which otherwise looks like a permanent hang.
    console.error("HQ signup failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
