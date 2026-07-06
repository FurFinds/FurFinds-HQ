import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  accent = "blue",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "blue" | "gold" | "success" | "warning";
}) {
  const accentClasses: Record<string, string> = {
    blue: "border-l-ff-dark-blue",
    gold: "border-l-ff-gold",
    success: "border-l-ff-success",
    warning: "border-l-ff-warning",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 border-l-4 bg-white p-4 shadow-card",
        accentClasses[accent]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
