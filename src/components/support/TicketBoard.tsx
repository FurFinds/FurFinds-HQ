"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { createTicket, updateTicket, type TicketInput } from "@/app/hq/customer-success/actions";
import type { SupportTicket, TicketPriority, TicketStatus } from "@/lib/types/database";

const emptyForm: TicketInput = {
  subject: "",
  message: "",
  priority: "medium",
  customer_name: "",
  customer_email: "",
};

export function TicketBoard({
  tickets,
  canManage,
}: {
  tickets: SupportTicket[];
  canManage: boolean;
}) {
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TicketInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      tickets.filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (priority !== "all" && t.priority !== priority) return false;
        return true;
      }),
    [tickets, status, priority]
  );

  function update<K extends keyof TicketInput>(key: K, value: TicketInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTicket(form);
      setForm(emptyForm);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-36">
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={() => setModalOpen(true)}>
            + New ticket
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{ticket.subject}</p>
                  <p className="max-w-xs truncate text-xs text-slate-500">{ticket.message}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {ticket.customer_name ?? "—"}
                  <p className="text-xs text-slate-400">{ticket.customer_email}</p>
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Select
                      value={ticket.priority}
                      onChange={(e) =>
                        startTransition(() =>
                          updateTicket(ticket.id, { priority: e.target.value as TicketPriority })
                        )
                      }
                      disabled={isPending}
                      className="w-28"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </Select>
                  ) : (
                    <StatusBadge status={ticket.priority} />
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Select
                      value={ticket.status}
                      onChange={(e) =>
                        startTransition(() =>
                          updateTicket(ticket.id, { status: e.target.value as TicketStatus })
                        )
                      }
                      disabled={isPending}
                      className="w-28"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Select>
                  ) : (
                    <StatusBadge status={ticket.status} />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(ticket.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New support ticket">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              required
              value={form.subject}
              onChange={(e) => update("subject", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Customer name</Label>
              <Input
                id="customer_name"
                value={form.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customer_email">Customer email</Label>
              <Input
                id="customer_email"
                type="email"
                value={form.customer_email}
                onChange={(e) => update("customer_email", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              id="priority"
              value={form.priority}
              onChange={(e) => update("priority", e.target.value as TicketPriority)}
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={4}
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ReplyTemplates() {
  const templates = [
    {
      name: "Verification delay",
      text: "Thanks for your patience — your application is in our review queue and typically takes 2-3 business days. We'll notify you as soon as there's an update.",
    },
    {
      name: "Listing correction",
      text: "We've updated your business listing with the changes you requested. Please check the live page and let us know if anything else needs adjusting.",
    },
    {
      name: "Refund processed",
      text: "Your refund has been processed and should appear on your statement within 5-7 business days.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {templates.map((t) => (
        <div key={t.name} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card">
          <p className="mb-1 text-sm font-semibold text-slate-900">{t.name}</p>
          <p className="text-sm text-slate-600">{t.text}</p>
        </div>
      ))}
    </div>
  );
}
