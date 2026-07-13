import "server-only";
import type { Business, BusinessTier } from "@/lib/types/database";

export interface AiAnalysisResult {
  tier: BusinessTier;
  confidence: number;
  policyExtraction: string;
  sentimentAnalysis: string;
}

const VALID_TIERS = new Set<BusinessTier>(["pets_allowed", "pet_friendly", "pet_inclusive"]);

/**
 * Runs AI-assisted tier verification via the Anthropic API directly from
 * the Next.js server — no separate Edge Function deployment required.
 * Reads ANTHROPIC_API_KEY from the server environment (set this in your
 * hosting provider's dashboard, e.g. Vercel Project Settings > Environment
 * Variables — never commit real values to .env files in the repo).
 */
export async function analyzeApplication(business: Business): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this server. Add it in your hosting provider's environment variables, then set NEXT_PUBLIC_AI_VERIFICATION_ENABLED=true."
    );
  }

  const applicationData = (business.application_data ?? {}) as Record<string, unknown>;

  const prompt = `You are FurFinds' business verification analyst. FurFinds has three tiers:
- "pets_allowed": basic access, clear policies, no history of complaints.
- "pet_friendly": amenities and clear policies, staff can answer policy questions.
- "pet_inclusive": pet-trained staff, minimal restrictions, premium experience, emergency protocols.

Review this business application and respond with ONLY a JSON object (no markdown fences) shaped like:
{"tier": "pets_allowed" | "pet_friendly" | "pet_inclusive", "confidence": <integer 0-100>, "policy_extraction": "<2-3 sentence summary of the business's actual pet policy, extracted from the data below>", "sentiment_analysis": "<1-2 sentence read on how trustworthy/complete this application is, and anything that needs human follow-up>"}

Business: ${business.name}
Category: ${business.category ?? "unknown"}
Website: ${business.website ?? "not provided"}
Description: ${business.description ?? "not provided"}
Pet policy: ${business.pet_policy ?? "not provided"}
Service animals allowed: ${business.service_animals_allowed ?? "unknown"}
ESA policy: ${business.esa_policy ?? "not provided"}
Self-assessed tier: ${applicationData.self_assessed_tier ?? "not provided"}
Photos submitted: ${applicationData.photo_count ?? 0}
ESAs allowed: ${applicationData.esa_allowed ?? "unknown"}
Breed restrictions: ${applicationData.breed_restrictions ?? "unknown"} (${applicationData.breed_restrictions_detail ?? "none noted"})
Staff trained on service animal regulations: ${applicationData.staff_trained_on_service_animals ?? "unknown"}
Category-specific answers: ${JSON.stringify(applicationData.category_answers ?? {})}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API responded ${res.status}: ${await res.text()}`);
  }

  const completion = await res.json();
  const text: string = completion.content?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text.trim());

  return {
    tier: VALID_TIERS.has(parsed.tier) ? parsed.tier : "pets_allowed",
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    policyExtraction: String(parsed.policy_extraction ?? "").slice(0, 2000),
    sentimentAnalysis: String(parsed.sentiment_analysis ?? "").slice(0, 1000),
  };
}
