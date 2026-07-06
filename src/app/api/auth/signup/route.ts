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
      role: resolvedRole,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}
