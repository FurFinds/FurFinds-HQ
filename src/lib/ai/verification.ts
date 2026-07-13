import "server-only";
import type { VerificationApplication } from "@/lib/types/database";

export interface AiAnalysisResult {
  tier: "basic" | "verified" | "premium";
  confidence: number;
  summary: string;
  flags: string[];
}

const VALID_TIERS = new Set(["basic", "verified", "premium"]);

/**
 * Runs AI-assisted tier verification via the Anthropic API directly from
 * the Next.js server — no separate Edge Function deployment required.
 * Reads ANTHROPIC_API_KEY from the server environment (set this in your
 * hosting provider's dashboard, e.g. Vercel Project Settings > Environment
 * Variables — never commit real values to .env files in the repo).
 */
export async function analyzeApplication(
  application: VerificationApplication
): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this server. Add it in your hosting provider's environment variables, then set NEXT_PUBLIC_AI_VERIFICATION_ENABLED=true."
    );
  }

  const applicationData = (application.application_data ?? {}) as Record<string, unknown>;
  const business = application.businesses;

  const prompt = `You are FurFinds' business verification analyst. FurFinds has three tiers:
- "basic" (Pets Allowed): basic access, clear policies, no history of complaints.
- "verified" (Pet-Friendly): amenities and clear policies, staff can answer policy questions.
- "premium" (Pet-Inclusive): pet-trained staff, minimal restrictions, premium experience, emergency protocols.

Review this business application and respond with ONLY a JSON object (no markdown fences) shaped like:
{"tier": "basic" | "verified" | "premium", "confidence": <integer 0-100>, "summary": "<2-3 sentence evidence summary>", "flags": ["<short_flag_slug>", ...]}

Flags should be short snake_case strings for anything that needs human follow-up (e.g. "missing_insurance_doc", "vague_pet_policy", "no_photos_provided"). Use an empty array if nothing stands out.

Business: ${business?.name ?? application.applicant_name}
Category: ${business?.category ?? application.category ?? "unknown"}
Website: ${business?.website ?? "not provided"}
Description: ${business?.description ?? "not provided"}
Self-assessed tier: ${applicationData.self_assessed_tier ?? "not provided"}
Photos submitted: ${applicationData.photo_count ?? 0}
Service animals allowed: ${applicationData.service_animals_allowed ?? "unknown"}
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
    tier: VALID_TIERS.has(parsed.tier) ? parsed.tier : "basic",
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    summary: String(parsed.summary ?? "").slice(0, 2000),
    flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 10) : [],
  };
}
