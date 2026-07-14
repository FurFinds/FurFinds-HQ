"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDate, initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { updateStaffRole } from "@/app/hq/team/actions";
import type { HqRole, Profile } from "@/lib/types/database";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [HqRole, string][];

export function StaffTable({
  staff,
  currentUserId,
  isAdmin,
}: {
  staff: Profile[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRoleChange(id: string, role: HqRole) {
    setError(null);
    startTransition(async () => {
      try {
        await updateStaffRole(id, role);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200/70">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="flex items-center gap-2 px-4 py-3 text-slate-900">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ff-gold/20 text-xs font-semibold text-ff-dark-blue">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(s.full_name ?? s.email)
                  )}
                </span>
                {s.full_name ?? "—"}
                {s.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
              </td>
              <td className="px-4 py-3 text-slate-600">{s.email}</td>
              <td className="px-4 py-3">
                {isAdmin ? (
                  <Select
                    value={s.role}
                    disabled={isPending}
                    onChange={(e) => handleRoleChange(s.id, e.target.value as HqRole)}
                    className="w-44"
                  >
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone="info">{ROLE_LABELS[s.role]}</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">{formatDate(s.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
