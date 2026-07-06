import { createClient } from "@/lib/supabase/server";
import type { SupportTicket } from "@/lib/types/database";

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}
