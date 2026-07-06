import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types/database";

export async function getBusinesses(): Promise<Business[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}
