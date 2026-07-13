import { createClient } from "@/lib/supabase/server";
import type { Profile, SiteUser } from "@/lib/types/database";

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getAllSiteUsers(): Promise<SiteUser[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}
