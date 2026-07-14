import { createClient } from "@/lib/supabase/server";
import type { Business, Verification } from "@/lib/types/database";

export type VerificationQueueItem = Business & { latestVerification: Verification | null };

export async function getVerificationQueue(): Promise<VerificationQueueItem[]> {
  const supabase = createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*, owner:owner_id (id, name, email)")
    .order("created_at", { ascending: false });

  const list = (businesses ?? []) as unknown as Business[];
  if (list.length === 0) return [];

  const { data: verifications } = await supabase
    .from("verification")
    .select("*")
    .in(
      "business_id",
      list.map((b) => b.id)
    )
    .order("created_at", { ascending: false });

  const latestByBusiness = new Map<string, Verification>();
  for (const v of verifications ?? []) {
    if (!v.business_id || latestByBusiness.has(v.business_id)) continue;
    latestByBusiness.set(v.business_id, v as Verification);
  }

  return list.map((b) => ({
    ...(b as Business),
    latestVerification: latestByBusiness.get(b.id) ?? null,
  }));
}
