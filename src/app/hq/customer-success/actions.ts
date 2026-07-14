"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { Report, ReportIssueType, ReportStatus } from "@/lib/types/database";

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "support") {
    throw new Error("You don't have permission to manage reports.");
  }
}

export interface ReportInput {
  user_email: string;
  issue_type: ReportIssueType;
  description: string;
  business_name: string;
}

export async function createReport(input: ReportInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  let businessId: string | null = null;
  if (input.business_name.trim()) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .ilike("name", input.business_name.trim())
      .maybeSingle();
    businessId = business?.id ?? null;
  }

  const { error } = await supabase.from("reports").insert({
    business_id: businessId,
    user_email: input.user_email,
    issue_type: input.issue_type,
    description: input.description,
    status: "pending",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/customer-success");
}

export async function updateReport(
  id: string,
  updates: { status?: ReportStatus; assigned_to?: string | null }
) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const payload: Partial<Report> = { ...updates };
  if (updates.status === "resolved") payload.resolved_at = new Date().toISOString();

  const { error } = await supabase.from("reports").update(payload).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/customer-success");
}
