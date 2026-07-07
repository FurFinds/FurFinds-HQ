import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HqRole, Profile } from "@/lib/types/database";

export interface SessionProfile {
  userId: string;
  email: string;
  profile: Profile;
}

const VALID_ROLES: HqRole[] = [
  "admin",
  "verification_manager",
  "support",
  "content_editor",
  "developer",
];

/**
 * Fetches the signed-in user's HQ profile for use in Server Components.
 * Redirects to /login if there is no session — middleware already guards
 * /hq routes, but this keeps each page safe if rendered directly.
 *
 * If the auth user exists but has no `profiles` row yet (e.g. created
 * directly in the Supabase dashboard before the auto-provisioning trigger
 * was in place), this creates one on the fly instead of bouncing the user
 * back to /login — which would otherwise loop against middleware sending
 * signed-in users away from /login.
 */
export async function requireProfile(): Promise<SessionProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  let profile = existingProfile;

  if (!profile) {
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

    if (createError || !createdProfile) {
      redirect("/login");
    }

    profile = createdProfile;
  }

  return { userId: user.id, email: user.email ?? "", profile };
}
