import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getAllProfiles, getAllCustomers } from "@/lib/data/team";
import { Card, CardHeader } from "@/components/ui/Card";
import { StaffTable } from "@/components/team/StaffTable";
import { formatDate, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

export default async function TeamPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "team");

  const [staff, customers] = await Promise.all([getAllProfiles(), getAllCustomers()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Team &amp; Users</h2>
        <p className="text-sm text-slate-500">
          Every HQ staff account and public-site member, with their roles.
        </p>
      </div>

      <Card>
        <CardHeader title="HQ Staff" subtitle={`${staff.length} staff account${staff.length === 1 ? "" : "s"}`} />
        <StaffTable staff={staff} currentUserId={profile.id} isAdmin={profile.role === "admin"} />
      </Card>

      <Card>
        <CardHeader
          title="Pet Owners (Customers)"
          subtitle={`${customers.length} signed-up pet parent${customers.length === 1 ? "" : "s"}`}
        />
        {customers.length === 0 ? (
          <p className="text-sm text-slate-400">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="flex items-center gap-2 px-4 py-3 text-slate-900">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ff-pale-blue text-xs font-semibold text-ff-dark-blue">
                        {initials(c.full_name)}
                      </span>
                      {c.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.status === "active" ? "success" : "error"}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
