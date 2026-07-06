"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { ComplianceStatus, ComplianceType } from "@/lib/types/database";

function assertCanManage(role: string) {
  if (role !== "admin") {
    throw new Error("You don't have permission to manage legal records.");
  }
}

export interface ComplianceInput {
  title: string;
  type: ComplianceType;
  status: ComplianceStatus;
  expires_at: string | null;
  document_url: string;
}

export async function createComplianceRecord(input: ComplianceInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("compliance_records").insert(input);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/legal");
}

export async function updateComplianceStatus(id: string, status: ComplianceStatus) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("compliance_records").update({ status }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/legal");
}

export async function deleteComplianceRecord(id: string) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("compliance_records").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/legal");
}
