"use client";

import { useMemo, useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { ApplicationDetail } from "./ApplicationDetail";
import type { VerificationApplication } from "@/lib/types/database";

const STATUS_OPTIONS = ["all", "pending", "needs_info", "approved", "rejected"];
const TIER_OPTIONS = ["all", "basic", "verified", "premium"];

export function VerificationBoard({
  applications,
  canReview,
}: {
  applications: VerificationApplication[];
  canReview: boolean;
}) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => a.category && set.add(a.category));
    return ["all", ...Array.from(set)];
  }, [applications]);

  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(applications[0]?.id ?? null);

  const filtered = applications.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (tier !== "all" && a.tier_requested !== tier) return false;
    if (category !== "all" && a.category !== category) return false;
    return true;
  });

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <FilterSelect label="Tier" value={tier} onChange={setTier} options={TIER_OPTIONS} />
        <FilterSelect
          label="Category"
          value={category}
          onChange={setCategory}
          options={categories}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200/70 bg-white p-2 shadow-card">
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-slate-400">No applications match these filters.</p>
            )}
            {filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedId(app.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  selected?.id === app.id
                    ? "border-ff-dark-blue bg-ff-pale-blue/60"
                    : "border-transparent hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {app.businesses?.name ?? app.applicant_name}
                  </p>
                  <StatusBadge status={app.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {app.category ?? "Uncategorized"} · Tier: {app.tier_requested}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Submitted {formatDate(app.submitted_at)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <ApplicationDetail application={selected} canReview={canReview} />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
              Select an application to review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-40">
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "All" : opt.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
