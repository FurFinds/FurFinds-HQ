import { createClient } from "@/lib/supabase/server";
import type { VerificationApplication } from "@/lib/types/database";

export async function getVerificationApplications(): Promise<VerificationApplication[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("verification_applications")
    .select("*, businesses:business_id (id, name, category, city, state)")
    .order("submitted_at", { ascending: false });

  return (data ?? []) as unknown as VerificationApplication[];
}
