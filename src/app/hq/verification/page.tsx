import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getVerificationApplications } from "@/lib/data/verification";
import { VerificationBoard } from "@/components/verification/VerificationBoard";

export default async function VerificationPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "verification");

  const applications = await getVerificationApplications();
  const canReview = profile.role === "admin" || profile.role === "verification_manager";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Verification Queue</h2>
        <p className="text-sm text-slate-500">
          Review pending business applications and AI-assisted analysis.
        </p>
      </div>
      <VerificationBoard applications={applications} canReview={canReview} />
    </div>
  );
}
