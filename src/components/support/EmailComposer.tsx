"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { sendEmail } from "@/app/hq/customer-success/email-actions";
import type { EmailLog } from "@/lib/types/database";

const TEMPLATES = [
  {
    name: "Verification approved",
    subject: "You're verified on FurFinds! 🐾",
    body: "Hi there,\n\nGreat news — your business has been verified on FurFinds. Your tier badge is now live on your public profile.\n\nThanks for being part of making pet-friendly mean something.\n\n— The FurFinds Team",
  },
  {
    name: "Verification needs more info",
    subject: "A quick follow-up on your FurFinds application",
    body: "Hi there,\n\nThanks for applying to FurFinds. Before we can finish reviewing your application, we need a bit more information. Our team will follow up shortly with specifics.\n\n— The FurFinds Team",
  },
  {
    name: "Welcome (pet parent)",
    subject: "Welcome to FurFinds",
    body: "Hi there,\n\nWelcome to FurFinds! You can now search verified pet-friendly businesses, save favorites, and leave reviews from your dashboard.\n\n— The FurFinds Team",
  },
];

const emptyForm = { recipient: "", subject: "", body: "" };

export function EmailComposer({ log }: { log: EmailLog[] }) {
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function applyTemplate(name: string) {
    const template = TEMPLATES.find((t) => t.name === name);
    if (!template) return;
    setForm((f) => ({ ...f, subject: template.subject, body: template.body }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);
    try {
      await sendEmail(form);
      setForm(emptyForm);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="template">Start from a template</Label>
          <Select id="template" onChange={(e) => applyTemplate(e.target.value)} defaultValue="">
            <option value="" disabled>
              Choose a template…
            </option>
            {TEMPLATES.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="recipient">To</Label>
          <Input
            id="recipient"
            type="email"
            required
            value={form.recipient}
            onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            required
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            rows={6}
            required
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>
        {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
        {success && !error && (
          <p className="text-sm text-[#15803d]">Email queued — check the log for delivery status.</p>
        )}
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send email"}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Recent emails</p>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {log.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No emails sent yet.
            </p>
          )}
          {log.map((e) => (
            <div key={e.id} className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-900">{e.subject}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                To {e.recipient} · {formatDateTime(e.created_at)}
              </p>
              {e.error && <p className="mt-1 text-xs text-[#b91c1c]">{e.error}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
