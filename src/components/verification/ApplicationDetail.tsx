"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { decideApplication, runAiAnalysis } from "@/app/hq/verification/actions";
import type { VerificationApplication } from "@/lib/types/database";

export function ApplicationDetail({
  application,
  canReview,
}: {
  application: VerificationApplication;
  canReview: boolean;
}) {
  const [notes, setNotes] = useState(application.review_notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    startTransition(async () => {
      try {
        await runAiAnalysis(application.id);
      } catch (e) {
        setAnalyzeError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setAnalyzing(false);
      }
    });
  }

  const business = application.businesses;
  const isDecided = application.status !== "pending" && application.status !== "needs_info";

  function handleDecision(decision: "approved" | "rejected" | "needs_info") {
    setError(null);
    setPendingDecision(decision);
    startTransition(async () => {
      try {
        await decideApplication(application.id, decision, notes);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={business?.name ?? application.applicant_name}
        subtitle={[business?.category, business?.city, business?.state].filter(Boolean).join(" · ")}
        action={<StatusBadge status={application.status} />}
      />

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Applicant</dt>
          <dd className="font-medium text-slate-900">{application.applicant_name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Contact</dt>
          <dd className="font-medium text-slate-900">{application.applicant_email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tier requested</dt>
          <dd className="font-medium capitalize text-slate-900">{application.tier_requested}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">{formatDateTime(application.submitted_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-ff-light-blue/40 bg-ff-pale-blue/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ff-dark-blue">AI Analysis</h4>
          <div className="flex items-center gap-2">
            {application.ai_score != null && (
              <span className="text-sm font-bold text-ff-dark-blue">{application.ai_score}/100</span>
            )}
            {canReview && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={analyzing}
                onClick={handleAnalyze}
              >
                {analyzing ? "Analyzing…" : "Run AI Analysis"}
              </Button>
            )}
          </div>
        </div>
        {analyzeError && <p className="mb-2 text-xs text-[#b91c1c]">{analyzeError}</p>}
        {application.ai_score != null && (
          <div className="mb-3 h-2 w-full rounded-full bg-white">
            <div
              className="h-2 rounded-full bg-ff-dark-blue"
              style={{ width: `${application.ai_score}%` }}
            />
          </div>
        )}
        <p className="text-sm text-slate-700">
          {application.ai_summary ?? "No AI analysis available for this application yet."}
        </p>
        {application.ai_flags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {application.ai_flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full bg-ff-warning/10 px-2.5 py-0.5 text-xs font-medium text-[#b45309]"
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {isDecided ? (
        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            Marked <span className="font-semibold capitalize">{application.status}</span> on{" "}
            {formatDateTime(application.reviewed_at)}.
          </p>
          {application.review_notes && (
            <p className="mt-1 italic">&ldquo;{application.review_notes}&rdquo;</p>
          )}
        </div>
      ) : canReview ? (
        <div className="mt-5 space-y-3">
          <Textarea
            rows={3}
            placeholder="Add review notes (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              disabled={isPending}
              onClick={() => handleDecision("approved")}
            >
              {isPending && pendingDecision === "approved" ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => handleDecision("rejected")}
            >
              {isPending && pendingDecision === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => handleDecision("needs_info")}
            >
              {isPending && pendingDecision === "needs_info" ? "Sending…" : "Request more info"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-400">
          You don&apos;t have permission to review applications.
        </p>
      )}
    </Card>
  );
}
