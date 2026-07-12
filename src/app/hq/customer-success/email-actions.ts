"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export interface SendEmailInput {
  recipient: string;
  subject: string;
  body: string;
  template?: string;
}

function assertCanSend(role: string) {
  if (role !== "admin" && role !== "support") {
    throw new Error("You don't have permission to send email.");
  }
}

export async function sendEmail(input: SendEmailInput) {
  const { userId, profile } = await requireProfile();
  assertCanSend(profile.role);

  const supabase = createClient();

  const { data: logRow, error: insertError } = await supabase
    .from("email_log")
    .insert({
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      template: input.template ?? null,
      status: "queued",
      sent_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !logRow) throw new Error(insertError?.message ?? "Could not queue email.");

  // Delegates the actual send to the `send-email` Edge Function (Resend).
  // If RESEND_API_KEY isn't configured on the project yet, the function
  // marks this row "failed" with a clear reason rather than the request
  // silently doing nothing — see supabase/functions/send-email/index.ts.
  const { error: invokeError } = await supabase.functions.invoke("send-email", {
    body: {
      emailLogId: logRow.id,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
    },
  });

  revalidatePath("/hq/customer-success");

  if (invokeError) {
    throw new Error(
      `Email queued but the send-email function couldn't be reached: ${invokeError.message}`
    );
  }
}
