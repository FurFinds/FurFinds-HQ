import { requireProfile } from "@/lib/auth/session";
import {
  getDashboardMetrics,
  getUpcomingMeetings,
  getActiveAlerts,
  getRevenueSeries,
} from "@/lib/data/dashboard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { AlertsFeed } from "@/components/dashboard/AlertsFeed";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  const [metrics, meetings, alerts, revenueSeries] = await Promise.all([
    getDashboardMetrics(),
    getUpcomingMeetings(),
    getActiveAlerts(),
    getRevenueSeries(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Welcome back, {profile.full_name?.split(" ")[0] ?? "there"}
        </h2>
        <p className="text-sm text-slate-500">Here&rsquo;s how FurFinds is doing today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Businesses" value={metrics.totalBusinesses.toLocaleString()} />
        <MetricCard label="Total Users" value={metrics.totalUsers.toLocaleString()} accent="gold" />
        <MetricCard
          label="Verification Pending"
          value={metrics.verificationPending.toLocaleString()}
          accent="warning"
          hint="Awaiting review"
        />
        <MetricCard
          label="Revenue"
          value={formatCurrency(metrics.revenueCents)}
          accent="success"
          hint="This billing period"
        />
        <MetricCard label="MRR" value={formatCurrency(metrics.mrrCents)} hint="Active subscriptions" />
        <MetricCard
          label="Churn"
          value={`${metrics.churnRate.toFixed(1)}%`}
          accent="warning"
          hint="Last 30 days"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue" subtitle="Monthly revenue vs. recurring baseline" />
          <RevenueChart data={revenueSeries} />
        </Card>
        <Card>
          <CardHeader title="Department Alerts" />
          <AlertsFeed alerts={alerts} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Upcoming Meetings" subtitle="Next scheduled department syncs" />
        <UpcomingMeetings meetings={meetings} />
      </Card>
    </div>
  );
}
