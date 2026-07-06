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
  const netCents = metrics.revenueCents - totalExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Finance</h2>
        <p className="text-sm text-slate-500">Revenue, expenses, and CSV import/export.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Revenue" value={formatCurrency(metrics.revenueCents)} accent="success" />
        <MetricCard label="MRR" value={formatCurrency(metrics.mrrCents)} />
        <MetricCard
          label="Expenses"
          value={formatCurrency(totalExpenses)}
          accent="warning"
        />
        <MetricCard label="Net" value={formatCurrency(netCents)} accent="gold" />
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
