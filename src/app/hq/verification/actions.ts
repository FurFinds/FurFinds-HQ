"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { analyzeApplication } from "@/lib/ai/verification";
import type { VerificationApplication } from "@/lib/types/database";

type Decision = "approved" | "rejected" | "needs_info";

export async function decideApplication(
  applicationId: string,
  decision: Decision,
  notes: string
) {
  const { userId, profile } = await requireProfile();

  if (profile.role !== "admin" && profile.role !== "verification_manager") {
    throw new Error("You don't have permission to review applications.");
  }

  const supabase = createClient();

  const { data: application, error: fetchError } = await supabase
    .from("verification_applications")
    .select("id, business_id, tier_requested")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    throw new Error("Application not found.");
  }

  const { error: updateError } = await supabase
    .from("verification_applications")
    .update({
      status: decision,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
    })
    .eq("id", applicationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (decision === "approved" && application.business_id) {
    await supabase
      .from("businesses")
      .update({
        status: "active",
        tier: application.tier_requested,
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.business_id);
  }

  if (decision === "rejected" && application.business_id) {
    await supabase
      .from("businesses")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", application.business_id);
  }

  revalidatePath("/hq/verification");
}

export async function runAiAnalysis(applicationId: string) {
  const { profile } = await requireProfile();

  if (profile.role !== "admin" && profile.role !== "verification_manager") {
    throw new Error("You don't have permission to run AI analysis.");
  }

  const supabase = createClient();
  const { data: application, error: fetchError } = await supabase
    .from("verification_applications")
    .select("*, businesses:business_id (name, category, description, website)")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    throw new Error("Application not found.");
  }

  const result = await analyzeApplication(application as unknown as VerificationApplication);

  const { error: updateError } = await supabase
    .from("verification_applications")
    .update({
      ai_score: result.confidence,
      ai_summary: `AI-suggested tier: ${result.tier}. ${result.summary}`,
      ai_flags: result.flags,
    })
    .eq("id", applicationId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/hq/verification");
}
