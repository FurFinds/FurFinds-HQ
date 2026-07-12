import { createClient } from "@/lib/supabase/server";
import type { Customer, Profile } from "@/lib/types/database";

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getAllCustomers(): Promise<Customer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}
