import { createClient } from "@/lib/supabase/server";
import type { EmailLog } from "@/lib/types/database";

export async function getEmailLog(): Promise<EmailLog[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
