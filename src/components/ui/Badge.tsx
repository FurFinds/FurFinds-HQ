import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "gold";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-ff-success/10 text-[#15803d]",
  warning: "bg-ff-warning/10 text-[#b45309]",
  error: "bg-ff-error/10 text-[#b91c1c]",
  info: "bg-ff-light-blue/20 text-ff-dark-blue",
  gold: "bg-ff-gold/15 text-[#8a6d1f]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  approved: "success",
  published: "success",
  valid: "success",
  resolved: "success",
  closed: "neutral",
  pending: "warning",
  expiring: "warning",
  needs_info: "warning",
  scheduled: "info",
  open: "info",
  draft: "neutral",
  suspended: "error",
  rejected: "error",
  expired: "error",
  flagged: "error",
  urgent: "error",
  high: "warning",
  medium: "info",
  low: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}
