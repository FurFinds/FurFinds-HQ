import { createClient } from "@/lib/supabase/server";

export async function getSiteSetting(key: string) {
  const supabase = createClient();
  const { data } = await supabase.from("site_settings").select("*").eq("key", key).single();
  return data ?? null;
}
