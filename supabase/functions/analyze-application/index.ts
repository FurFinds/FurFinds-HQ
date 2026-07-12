// Supabase Edge Function: analyze-application
//
// Runs AI-assisted tier verification on a business's application, using
// Claude to review the application data (self-assessed tier, category
// answers, service/ESA/breed policy answers, website, photo count, etc.)
// and returns a suggested tier, confidence score, and evidence summary.
//
// Deploy with: `supabase functions deploy analyze-application`
// Requires this secret set on the Supabase project:
//   supabase secrets set ANTHROPIC_API_KEY=...
//
// Called from HQ's `runAiAnalysis` server action via
// `supabase.functions.invoke("analyze-application", { body: { applicationId } })`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AnalyzeRequest {
  applicationId: string;
}

const TIER_RANK: Record<string, number> = { basic: 0, verified: 1, premium: 2 };

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { applicationId } = (await req.json()) as AnalyzeRequest;

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on this project." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: application, error: fetchError } = await supabase
    .from("verification_applications")
    .select("*, businesses:business_id (name, category, description, website)")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    return new Response(JSON.stringify({ error: "Application not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = `You are FurFinds' business verification analyst. FurFinds has three tiers:
- "basic" (Pets Allowed): basic access, clear policies, no history of complaints.
- "verified" (Pet-Friendly): amenities and clear policies, staff can answer policy questions.
- "premium" (Pet-Inclusive): pet-trained staff, minimal restrictions, premium experience, emergency protocols.

Review this business application and respond with ONLY a JSON object (no markdown fences) shaped like:
{"tier": "basic" | "verified" | "premium", "confidence": <integer 0-100>, "summary": "<2-3 sentence evidence summary>", "flags": ["<short_flag_slug>", ...]}

Flags should be short snake_case strings for anything that needs human follow-up (e.g. "missing_insurance_doc", "vague_pet_policy", "no_photos_provided"). Use an empty array if nothing stands out.

Business: ${application.businesses?.name ?? application.applicant_name}
Category: ${application.businesses?.category ?? application.category ?? "unknown"}
Website: ${application.businesses?.website ?? "not provided"}
Description: ${application.businesses?.description ?? "not provided"}
Self-assessed tier: ${application.application_data?.self_assessed_tier ?? "not provided"}
Photos submitted: ${application.application_data?.photo_count ?? 0}
Service animals allowed: ${application.application_data?.service_animals_allowed ?? "unknown"}
ESAs allowed: ${application.application_data?.esa_allowed ?? "unknown"}
Breed restrictions: ${application.application_data?.breed_restrictions ?? "unknown"} (${application.application_data?.breed_restrictions_detail ?? "none noted"})
Staff trained on service animal regulations: ${application.application_data?.staff_trained_on_service_animals ?? "unknown"}
Category-specific answers: ${JSON.stringify(application.application_data?.category_answers ?? {})}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
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

    const tier = TIER_RANK[parsed.tier] !== undefined ? parsed.tier : "basic";
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const summary = String(parsed.summary ?? "").slice(0, 2000);
    const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 10) : [];

    const { error: updateError } = await supabase
      .from("verification_applications")
      .update({
        ai_score: confidence,
        ai_summary: `AI-suggested tier: ${tier}. ${summary}`,
        ai_flags: flags,
      })
      .eq("id", applicationId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ tier, confidence, summary, flags }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error running AI analysis.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
