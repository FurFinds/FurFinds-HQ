import "server-only";

export interface SendViaResendResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends an email via the Resend API directly from the Next.js server —
 * no separate Edge Function deployment required. Reads RESEND_API_KEY /
 * RESEND_FROM from the server environment (set these in your hosting
 * provider's dashboard, e.g. Vercel Project Settings > Environment
 * Variables — never commit real values to .env files in the repo).
 */
export async function sendViaResend(params: {
  recipient: string;
  subject: string;
  body: string;
}): Promise<SendViaResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "FurFinds HQ <hq@furfinds.com>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set on this server." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.recipient],
        subject: params.subject,
        html: params.body.replace(/\n/g, "<br/>"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Resend responded ${res.status}: ${detail}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}
