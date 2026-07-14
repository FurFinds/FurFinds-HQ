import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types/database";

export async function getReports(): Promise<Report[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("reports")
    .select("*, business:business_id (id, name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}
