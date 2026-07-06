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
    redirect("/login");
  }

  return { userId: user.id, email: user.email ?? "", profile };
}
