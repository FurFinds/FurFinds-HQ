import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getBusinesses } from "@/lib/data/businesses";
import { getSiteSetting } from "@/lib/data/site";
import { BusinessTable } from "@/components/operations/BusinessTable";
import { FounderPhotoUploader } from "@/components/operations/FounderPhotoUploader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function OperationsPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "operations");

  const [businesses, founderPhoto] = await Promise.all([
    getBusinesses(),
    getSiteSetting("founder_photo"),
  ]);

  const canManage = ["admin", "verification_manager", "support"].includes(profile.role);
  const canEditContent = profile.role === "admin" || profile.role === "content_editor";
  const featured = businesses.filter((b) => b.featured);

  const tierCounts = {
    basic: businesses.filter((b) => b.tier === "basic").length,
    verified: businesses.filter((b) => b.tier === "verified").length,
    premium: businesses.filter((b) => b.tier === "premium").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Operations</h2>
        <p className="text-sm text-slate-500">
          Manage businesses, subscription tiers, and site content.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Tier Management" subtitle="Businesses by subscription tier" />
          <div className="space-y-3">
            <TierRow label="Basic" count={tierCounts.basic} tone="neutral" />
            <TierRow label="Verified" count={tierCounts.verified} tone="info" />
            <TierRow label="Premium" count={tierCounts.premium} tone="gold" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Content Management" subtitle="Founder photo and featured businesses" />
          <FounderPhotoUploader
            initialUrl={(founderPhoto?.value?.url as string) ?? null}
            canEdit={canEditContent}
            role={profile.role}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Featured businesses ({featured.length})
            </p>
            {featured.length === 0 ? (
              <p className="text-sm text-slate-400">
                No businesses are featured yet — feature one from the table below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {featured.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full bg-ff-pale-blue px-3 py-1 text-xs font-medium text-ff-dark-blue"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900">All Businesses</h3>
        <BusinessTable businesses={businesses} canManage={canManage} />
      </div>
    </div>
  );
}

function TierRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "neutral" | "info" | "gold";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <Badge tone={tone}>{count}</Badge>
      </div>
    </div>
  );
}
