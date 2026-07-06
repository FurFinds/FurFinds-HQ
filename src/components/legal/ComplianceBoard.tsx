"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import {
  createComplianceRecord,
  deleteComplianceRecord,
  updateComplianceStatus,
  type ComplianceInput,
} from "@/app/hq/legal/actions";
import type { ComplianceRecord, ComplianceStatus, ComplianceType } from "@/lib/types/database";

const TYPE_LABEL: Record<ComplianceType, string> = {
  contract: "Contract",
  insurance: "Insurance",
  compliance_check: "Compliance check",
};

const emptyForm: ComplianceInput = {
  title: "",
  type: "contract",
  status: "pending",
  expires_at: null,
  document_url: "",
};

export function ComplianceBoard({
  records,
  canManage,
}: {
  records: ComplianceRecord[];
  canManage: boolean;
}) {
  const [type, setType] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ComplianceInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => records.filter((r) => type === "all" || r.type === type),
    [records, type]
  );

  function update<K extends keyof ComplianceInput>(key: K, value: ComplianceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createComplianceRecord(form);
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
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">
          <option value="all">All record types</option>
          <option value="contract">Contracts</option>
          <option value="insurance">Insurance</option>
          <option value="compliance_check">Compliance checks</option>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={() => setModalOpen(true)}>
            + Add record
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Record</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{record.title}</p>
                  {record.document_url && (
                    <a
                      href={record.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-ff-dark-blue hover:underline"
                    >
                      View document
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[record.type]}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Select
                      value={record.status}
                      onChange={(e) =>
                        startTransition(() =>
                          updateComplianceStatus(record.id, e.target.value as ComplianceStatus)
                        )
                      }
                      disabled={isPending}
                      className="w-32"
                    >
                      <option value="valid">Valid</option>
                      <option value="expiring">Expiring</option>
                      <option value="expired">Expired</option>
                      <option value="pending">Pending</option>
                    </Select>
                  ) : (
                    <StatusBadge status={record.status} />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(record.expires_at)}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-xs font-medium text-ff-error hover:underline"
                      onClick={() => startTransition(() => deleteComplianceRecord(record.id))}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                  No records match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add legal record">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                value={form.type}
                onChange={(e) => update("type", e.target.value as ComplianceType)}
              >
                <option value="contract">Contract</option>
                <option value="insurance">Insurance</option>
                <option value="compliance_check">Compliance check</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={form.status}
                onChange={(e) => update("status", e.target.value as ComplianceStatus)}
              >
                <option value="valid">Valid</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
                <option value="pending">Pending</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="expires_at">Expiration date</Label>
            <Input
              id="expires_at"
              type="date"
              value={form.expires_at ?? ""}
              onChange={(e) => update("expires_at", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="document_url">Document link</Label>
            <Input
              id="document_url"
              type="url"
              value={form.document_url}
              onChange={(e) => update("document_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add record"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
