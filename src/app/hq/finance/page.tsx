import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getExpenses } from "@/lib/data/finance";
import { getDashboardMetrics, getRevenueSeries } from "@/lib/data/dashboard";
import { ExpenseBoard } from "@/components/finance/ExpenseBoard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export default async function FinancePage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "finance");

  const [expenses, metrics, revenueSeries] = await Promise.all([
    getExpenses(),
    getDashboardMetrics(),
    getRevenueSeries(),
  ]);

  const canManage = profile.role === "admin";
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Finance</h2>
        <p className="text-sm text-slate-500">
          Subscriptions, expenses, and CSV import/export. Revenue reporting will populate once Stripe
          billing is connected.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Active Subscriptions" value={metrics.activeSubscriptions.toLocaleString()} accent="success" />
        <MetricCard label="Canceled (30d)" value={metrics.canceledSubscriptions30d.toLocaleString()} />
        <MetricCard label="Expenses" value={formatCurrency(totalExpenses)} accent="warning" />
        <MetricCard label="Churn" value={`${metrics.churnRate.toFixed(1)}%`} accent="gold" />
      </div>

      <Card>
        <CardHeader title="Revenue Trend" subtitle="Monthly revenue vs. recurring baseline" />
        <RevenueChart data={revenueSeries} />
      </Card>

      <Card>
        <CardHeader title="Expenses" subtitle="Track spend and reconcile with your accounting system" />
        <ExpenseBoard expenses={expenses} canManage={canManage} />
      </Card>
    </div>
  );
}
