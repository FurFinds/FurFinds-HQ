// Supabase Edge Function: send-email
//
// Sends an email via Resend and records the outcome in `public.email_log`.
// Deploy with: `supabase functions deploy send-email`
// Requires these secrets set on the Supabase project:
//   supabase secrets set RESEND_API_KEY=... RESEND_FROM="FurFinds <hq@furfinds.com>"
//
// Called from HQ's `sendEmail` server action via `supabase.functions.invoke("send-email", ...)`.
// If RESEND_API_KEY isn't configured, this responds with a clear error so the
// caller can mark the email_log row "failed" instead of silently no-oping.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendEmailRequest {
  emailLogId: string;
  recipient: string;
  subject: string;
  body: string;
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM") ?? "FurFinds HQ <hq@furfinds.com>";

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = (await req.json()) as SendEmailRequest;

  if (!resendApiKey) {
    await supabase
      .from("email_log")
      .update({ status: "failed", error: "RESEND_API_KEY is not configured on this project." })
      .eq("id", payload.emailLogId);

    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY is not configured on this project." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [payload.recipient],
        subject: payload.subject,
        html: payload.body.replace(/\n/g, "<br/>"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend responded ${res.status}: ${detail}`);
    }

    await supabase
      .from("email_log")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
      .eq("id", payload.emailLogId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending email.";
    await supabase.from("email_log").update({ status: "failed", error: message }).eq(
      "id",
      payload.emailLogId
    );
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
