import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getReports } from "@/lib/data/support";
import { getEmailLog } from "@/lib/data/email";
import { getAllProfiles } from "@/lib/data/team";
import { ReportBoard, ReplyTemplates } from "@/components/support/ReportBoard";
import { EmailComposer } from "@/components/support/EmailComposer";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/dashboard/MetricCard";

export default async function CustomerSuccessPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "customer-success");

  const [reports, emailLog, staff] = await Promise.all([getReports(), getEmailLog(), getAllProfiles()]);
  const canManage = profile.role === "admin" || profile.role === "support";
  const open = reports.filter((r) => r.status === "pending" || r.status === "reviewing");
  const urgent = reports.filter(
    (r) => (r.issue_type === "safety_concern" || r.issue_type === "policy_violation") && r.status !== "resolved" && r.status !== "dismissed"
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Customer Success</h2>
        <p className="text-sm text-slate-500">Business complaint reports, email, and reply templates.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Open reports" value={open.length.toLocaleString()} />
        <MetricCard label="Needs attention" value={urgent.length.toLocaleString()} accent="warning" />
        <MetricCard label="Total reports" value={reports.length.toLocaleString()} accent="gold" />
      </div>

      <Card>
        <CardHeader title="Inquiry Reports" subtitle="All customer and business complaint reports" />
        <ReportBoard reports={reports} canManage={canManage} assignees={staff} />
      </Card>

      <Card>
        <CardHeader
          title="Needs Attention"
          subtitle="Safety concerns and policy violations awaiting follow-up"
        />
        {urgent.length === 0 ? (
          <p className="text-sm text-slate-400">No urgent reports right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {urgent.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <span className="font-medium text-slate-900">{r.business?.name ?? "Unspecified business"}</span>{" "}
                <span className="text-slate-400">— {r.user_email ?? "Unknown reporter"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Reply Templates" subtitle="Common responses for faster replies" />
        <ReplyTemplates />
      </Card>

      <Card>
        <CardHeader title="Email" subtitle="Compose and send email directly from HQ" />
        <EmailComposer log={emailLog} />
      </Card>
    </div>
  );
}
