"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { decideBusiness, runAiAnalysis } from "@/app/hq/verification/actions";
import type { VerificationQueueItem } from "@/lib/data/verification";

// Flip once ANTHROPIC_API_KEY is set on your hosting provider (see
// src/lib/ai/verification.ts). Until then the button stays visibly
// disabled instead of erroring when clicked.
const AI_VERIFICATION_ENABLED = process.env.NEXT_PUBLIC_AI_VERIFICATION_ENABLED === "true";

export function ApplicationDetail({
  business,
  canReview,
}: {
  business: VerificationQueueItem;
  canReview: boolean;
}) {
  const [notes, setNotes] = useState(business.latestVerification?.notes ?? "");
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
        await runAiAnalysis(business.id);
      } catch (e) {
        setAnalyzeError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setAnalyzing(false);
      }
    });
  }

  const applicationData = (business.application_data ?? {}) as Record<string, unknown>;
  const isDecided = business.verification_status === "approved" || business.verification_status === "rejected";
  const latest = business.latestVerification;

  function handleDecision(decision: "approved" | "rejected" | "needs_info") {
    setError(null);
    setPendingDecision(decision);
    startTransition(async () => {
      try {
        await decideBusiness(business.id, decision, notes);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={business.name}
        subtitle={[business.category, business.city, business.state].filter(Boolean).join(" · ")}
        action={<StatusBadge status={business.verification_status} />}
      />

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Owner</dt>
          <dd className="font-medium text-slate-900">{business.owner?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Contact</dt>
          <dd className="font-medium text-slate-900">
            {business.owner?.email ?? (applicationData.email as string) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Tier requested</dt>
          <dd className="font-medium capitalize text-slate-900">{(business.tier ?? "unknown").replace("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">{formatDateTime(business.created_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-ff-light-blue/40 bg-ff-pale-blue/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-ff-dark-blue">AI Analysis</h4>
            {!AI_VERIFICATION_ENABLED && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Coming soon
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {latest?.ai_confidence != null && (
              <span className="text-sm font-bold text-ff-dark-blue">{latest.ai_confidence}/100</span>
            )}
            {canReview && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={analyzing || !AI_VERIFICATION_ENABLED}
                title={
                  AI_VERIFICATION_ENABLED
                    ? undefined
                    : "Add ANTHROPIC_API_KEY on your hosting provider to enable this."
                }
                onClick={handleAnalyze}
              >
                {analyzing ? "Analyzing…" : "Run AI Analysis"}
              </Button>
            )}
          </div>
        </div>
        {!AI_VERIFICATION_ENABLED && !latest?.ai_confidence && (
          <p className="mb-2 text-xs text-slate-500">
            AI-assisted tier suggestions aren&rsquo;t connected yet. Add an Anthropic API key to enable
            this — see src/lib/ai/verification.ts for setup.
          </p>
        )}
        {analyzeError && <p className="mb-2 text-xs text-[#b91c1c]">{analyzeError}</p>}
        {latest?.ai_confidence != null && (
          <div className="mb-3 h-2 w-full rounded-full bg-white">
            <div
              className="h-2 rounded-full bg-ff-dark-blue"
              style={{ width: `${latest.ai_confidence}%` }}
            />
          </div>
        )}
        {latest?.ai_tier_suggestion && (
          <p className="text-sm font-medium text-slate-800">
            Suggested tier: <span className="capitalize">{latest.ai_tier_suggestion.replace("_", " ")}</span>
          </p>
        )}
        <p className="mt-1 text-sm text-slate-700">
          {latest?.ai_policy_extraction ?? "No AI analysis available for this business yet."}
        </p>
        {latest?.ai_sentiment_analysis && (
          <p className="mt-2 text-xs italic text-slate-500">{latest.ai_sentiment_analysis}</p>
        )}
      </div>

      {isDecided ? (
        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            Marked <span className="font-semibold capitalize">{business.verification_status}</span>
            {latest?.decided_at && <> on {formatDateTime(latest.decided_at)}</>}.
          </p>
          {latest?.notes && <p className="mt-1 italic">&ldquo;{latest.notes}&rdquo;</p>}
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
