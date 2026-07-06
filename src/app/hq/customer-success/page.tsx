import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getSupportTickets } from "@/lib/data/support";
import { TicketBoard, ReplyTemplates } from "@/components/support/TicketBoard";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/dashboard/MetricCard";

export default async function CustomerSuccessPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "customer-success");

  const tickets = await getSupportTickets();
  const canManage = profile.role === "admin" || profile.role === "support";
  const open = tickets.filter((t) => t.status === "open" || t.status === "pending");
  const complaints = tickets.filter(
    (t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "closed"
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Customer Success</h2>
        <p className="text-sm text-slate-500">Support tickets, complaint reports, and reply templates.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Open tickets" value={open.length.toLocaleString()} />
        <MetricCard label="Needs attention" value={complaints.length.toLocaleString()} accent="warning" />
        <MetricCard label="Total tickets" value={tickets.length.toLocaleString()} accent="gold" />
      </div>

      <Card>
        <CardHeader title="Ticket Management" subtitle="All customer support tickets" />
        <TicketBoard tickets={tickets} canManage={canManage} />
      </Card>

      <Card>
        <CardHeader
          title="Complaint Reports"
          subtitle="Urgent and high-priority tickets needing follow-up"
        />
        {complaints.length === 0 ? (
          <p className="text-sm text-slate-400">No urgent complaints right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {complaints.map((t) => (
              <li key={t.id} className="py-2 text-sm">
                <span className="font-medium text-slate-900">{t.subject}</span>{" "}
                <span className="text-slate-400">— {t.customer_name ?? "Unknown customer"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Reply Templates" subtitle="Common responses for faster replies" />
        <ReplyTemplates />
      </Card>
    </div>
  );
}
