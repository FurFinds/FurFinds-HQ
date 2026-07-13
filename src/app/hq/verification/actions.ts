"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { analyzeApplication } from "@/lib/ai/verification";
import type { Business, VerificationStatus } from "@/lib/types/database";

type Decision = "approved" | "rejected" | "needs_info";

const STATUS_FOR_DECISION: Record<Decision, VerificationStatus> = {
  approved: "approved",
  rejected: "rejected",
  needs_info: "in_progress",
};

export async function decideBusiness(businessId: string, decision: Decision, notes: string) {
  const { userId, profile } = await requireProfile();

  if (profile.role !== "admin" && profile.role !== "verification_manager") {
    throw new Error("You don't have permission to review applications.");
  }

  const supabase = createClient();
  const verificationStatus = STATUS_FOR_DECISION[decision];
  const decidedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      verification_status: verificationStatus,
      is_active: verificationStatus === "approved",
      updated_at: decidedAt,
    })
    .eq("id", businessId);

  if (updateError) throw new Error(updateError.message);

  const { error: verificationError } = await supabase.from("verification").insert({
    business_id: businessId,
    human_decision: decision === "needs_info" ? "overridden" : decision,
    notes: notes || null,
    reviewed_by: userId,
    decided_at: decidedAt,
  });

  if (verificationError) throw new Error(verificationError.message);

  revalidatePath("/hq/verification");
}

export async function runAiAnalysis(businessId: string) {
  const { profile } = await requireProfile();

  if (profile.role !== "admin" && profile.role !== "verification_manager") {
    throw new Error("You don't have permission to run AI analysis.");
  }

  const supabase = createClient();
  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    throw new Error("Business not found.");
  }

  const result = await analyzeApplication(business as Business);

  const { error: insertError } = await supabase.from("verification").insert({
    business_id: businessId,
    ai_score: result.confidence,
    ai_confidence: result.confidence,
    ai_tier_suggestion: result.tier,
    ai_policy_extraction: result.policyExtraction,
    ai_sentiment_analysis: result.sentimentAnalysis,
  });

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/hq/verification");
}
