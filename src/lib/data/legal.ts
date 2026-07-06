import { createClient } from "@/lib/supabase/server";
import type { ComplianceRecord } from "@/lib/types/database";

export async function getComplianceRecords(): Promise<ComplianceRecord[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("compliance_records")
    .select("*")
    .order("expires_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}
