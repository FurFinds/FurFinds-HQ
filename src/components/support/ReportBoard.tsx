"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { createReport, updateReport, type ReportInput } from "@/app/hq/customer-success/actions";
import type { Profile, Report, ReportIssueType, ReportStatus } from "@/lib/types/database";

const emptyForm: ReportInput = {
  user_email: "",
  issue_type: "other",
  description: "",
  business_name: "",
};

export function ReportBoard({
  reports,
  canManage,
  assignees = [],
}: {
  reports: Report[];
  canManage: boolean;
  assignees?: Profile[];
}) {
  const [status, setStatus] = useState("all");
  const [issueType, setIssueType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ReportInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (issueType !== "all" && r.issue_type !== issueType) return false;
        return true;
      }),
    [reports, status, issueType]
  );

  function update<K extends keyof ReportInput>(key: K, value: ReportInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createReport(form);
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
          <option value="pending">Pending</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </Select>
        <Select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="w-44">
          <option value="all">All issue types</option>
          <option value="policy_violation">Policy Violation</option>
          <option value="false_information">False Information</option>
          <option value="unwelcoming_staff">Unwelcoming Staff</option>
          <option value="safety_concern">Safety Concern</option>
          <option value="other">Other</option>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={() => setModalOpen(true)}>
            + Log report
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{report.business?.name ?? "Unspecified business"}</p>
                  <p className="max-w-xs truncate text-xs text-slate-500">{report.description}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{report.user_email ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={report.issue_type ?? "other"} />
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Select
                      value={report.status}
                      onChange={(e) =>
                        startTransition(() =>
                          updateReport(report.id, { status: e.target.value as ReportStatus })
                        )
                      }
                      disabled={isPending}
                      className="w-32"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </Select>
                  ) : (
                    <StatusBadge status={report.status} />
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Select
                      value={report.assigned_to ?? ""}
                      onChange={(e) =>
                        startTransition(() =>
                          updateReport(report.id, { assigned_to: e.target.value || null })
                        )
                      }
                      disabled={isPending}
                      className="w-36"
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name ?? a.email}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-slate-500">
                      {assignees.find((a) => a.id === report.assigned_to)?.full_name ?? "Unassigned"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(report.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No reports match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log a report">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business name (optional)</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) => update("business_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="user_email">Reporter email</Label>
            <Input
              id="user_email"
              type="email"
              required
              value={form.user_email}
              onChange={(e) => update("user_email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issue_type">Issue type</Label>
            <Select
              id="issue_type"
              value={form.issue_type}
              onChange={(e) => update("issue_type", e.target.value as ReportIssueType)}
            >
              <option value="policy_violation">Policy Violation</option>
              <option value="false_information">False Information</option>
              <option value="unwelcoming_staff">Unwelcoming Staff</option>
              <option value="safety_concern">Safety Concern</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              required
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Log report"}
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
