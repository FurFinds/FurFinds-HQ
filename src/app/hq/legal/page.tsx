import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getComplianceRecords } from "@/lib/data/legal";
import { ComplianceBoard } from "@/components/legal/ComplianceBoard";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/dashboard/MetricCard";

export default async function LegalPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "legal");

  const records = await getComplianceRecords();
  const canManage = profile.role === "admin";
  const expiringSoon = records.filter((r) => r.status === "expiring" || r.status === "expired");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Legal & Compliance</h2>
        <p className="text-sm text-slate-500">Contracts, compliance checks, and insurance records.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Total records" value={records.length.toLocaleString()} />
        <MetricCard
          label="Needs attention"
          value={expiringSoon.length.toLocaleString()}
          accent="warning"
        />
        <MetricCard
          label="Contracts"
          value={records.filter((r) => r.type === "contract").length.toLocaleString()}
          accent="gold"
        />
      </div>

      <Card>
        <CardHeader title="Records" subtitle="Contracts, insurance, and compliance checks" />
        <ComplianceBoard records={records} canManage={canManage} />
      </Card>
    </div>
  );
}
