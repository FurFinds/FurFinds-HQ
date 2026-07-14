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
  const activeLive = businesses.filter((b) => b.is_active && b.verification_status === "approved");

  const tierCounts = {
    petsAllowed: businesses.filter((b) => b.tier === "pets_allowed").length,
    petFriendly: businesses.filter((b) => b.tier === "pet_friendly").length,
    petInclusive: businesses.filter((b) => b.tier === "pet_inclusive").length,
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
          <CardHeader title="Tier Management" subtitle="Businesses by verification tier" />
          <div className="space-y-3">
            <TierRow label="Pets Allowed" count={tierCounts.petsAllowed} tone="neutral" />
            <TierRow label="Pet-Friendly" count={tierCounts.petFriendly} tone="info" />
            <TierRow label="Pet-Inclusive" count={tierCounts.petInclusive} tone="gold" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Content Management" subtitle="Founder photo and live businesses" />
          <FounderPhotoUploader
            initialUrl={(founderPhoto?.value?.url as string) ?? null}
            canEdit={canEditContent}
            role={profile.role}
          />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Live on public site ({activeLive.length})
            </p>
            {activeLive.length === 0 ? (
              <p className="text-sm text-slate-400">
                No businesses are live yet — approve one from the Verification queue or activate it below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeLive.map((b) => (
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
