"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { sendViaResend } from "@/lib/email/resend";

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

  const result = await sendViaResend({
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
  });

  await supabase
    .from("email_log")
    .update(
      result.ok
        ? { status: "sent", sent_at: new Date().toISOString(), error: null }
        : { status: "failed", error: result.error }
    )
    .eq("id", logRow.id);

  revalidatePath("/hq/customer-success");

  if (!result.ok) {
    throw new Error(`Email logged but not sent: ${result.error}`);
  }
}
