"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { BusinessModal } from "./BusinessModal";
import { deleteBusiness, toggleFeatured } from "@/app/hq/operations/actions";
import { formatDate } from "@/lib/utils";
import type { Business } from "@/lib/types/database";

const TIER_TONE: Record<string, "neutral" | "silver" | "gold" | "bronze"> = {
  basic: "neutral",
  verified: "neutral",
  premium: "gold",
};

export function BusinessTable({
  businesses,
  canManage,
}: {
  businesses: Business[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return businesses.filter((b) => {
      if (tier !== "all" && b.tier !== tier) return false;
      if (status !== "all" && b.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !b.name.toLowerCase().includes(q) &&
          !(b.category ?? "").toLowerCase().includes(q) &&
          !(b.city ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [businesses, search, tier, status]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(business: Business) {
    setEditing(business);
    setModalOpen(true);
  }

  function handleDelete(business: Business) {
    if (!confirm(`Delete ${business.name}? This cannot be undone.`)) return;
    startTransition(() => deleteBusiness(business.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search businesses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={tier} onChange={(e) => setTier(e.target.value)} className="w-36">
          <option value="all">All tiers</option>
          <option value="basic">Basic</option>
          <option value="verified">Verified</option>
          <option value="premium">Premium</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={openAdd}>
            + Add business
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3 font-medium">Added</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((business) => (
              <tr key={business.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{business.name}</span>
                    {business.featured && <Badge tone="gold">Featured</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{business.category ?? "Uncategorized"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[business.city, business.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={TIER_TONE[business.tier] === "gold" ? "gold" : "neutral"}>
                    {business.tier}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={business.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {business.rating > 0 ? `${business.rating.toFixed(1)} (${business.review_count})` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(business.created_at)}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="text-xs font-medium text-ff-dark-blue hover:underline"
                        onClick={() => startTransition(() => toggleFeatured(business.id, !business.featured))}
                        disabled={isPending}
                      >
                        {business.featured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        className="text-xs font-medium text-ff-dark-blue hover:underline"
                        onClick={() => openEdit(business)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs font-medium text-ff-error hover:underline"
                        onClick={() => handleDelete(business)}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                  No businesses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BusinessModal open={modalOpen} onClose={() => setModalOpen(false)} business={editing} />
    </div>
  );
}
