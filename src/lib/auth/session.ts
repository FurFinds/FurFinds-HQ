import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export interface SessionProfile {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Fetches the signed-in user's HQ profile for use in Server Components.
 * Redirects to /login if there is no session — middleware already guards
 * /hq routes, but this keeps each page safe if rendered directly.
 *
 * Deny by default: an authenticated Supabase user with no `profiles` row
 * gets signed out and sent to /login, full stop — this never auto-creates
 * a profile (e.g. defaulting to 'support'). Profiles are provisioned only
 * by the handle_new_user() DB trigger (which itself only fires for users
 * created with a valid role in app_metadata via the code-gated
 * /api/auth/signup route) or by an admin explicitly granting access from
 * /hq/team. Auto-provisioning here would let ANY authenticated Supabase
 * user — including a pet owner or business account from the public
 * FurFinds website, if it shares this project — silently get HQ access.
 */
export async function requireProfile(): Promise<SessionProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=no_hq_access");
  }

  return { userId: user.id, email: user.email ?? "", profile };
}
