import { cn } from "@/lib/utils";
import type { DepartmentAlert } from "@/lib/types/database";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-ff-light-blue",
  warning: "bg-ff-warning",
  critical: "bg-ff-error",
};

export function AlertsFeed({ alerts }: { alerts: DepartmentAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-slate-400">No active alerts. All clear.</p>;
  }

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-3">
          <span
            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[alert.severity])}
          />
          <div>
            <p className="text-sm text-slate-800">{alert.message}</p>
            <p className="text-xs text-slate-500">{alert.department}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
