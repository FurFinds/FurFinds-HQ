import { createClient } from "@/lib/supabase/server";

export interface DashboardMetrics {
  totalBusinesses: number;
  totalUsers: number;
  verificationPending: number;
  revenueCents: number;
  mrrCents: number;
  churnRate: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();

  const [
    { count: totalBusinesses },
    { count: totalUsers },
    { count: verificationPending },
    { data: activeSubs },
    { data: pastDueSubs },
    { count: recentChurnCount },
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase
      .from("verification_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("subscriptions").select("mrr_cents").eq("status", "active"),
    supabase.from("subscriptions").select("mrr_cents").eq("status", "past_due"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "canceled")
      .gte("canceled_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const mrrCents = (activeSubs ?? []).reduce((sum, s) => sum + (s.mrr_cents ?? 0), 0);
  const pastDueCents = (pastDueSubs ?? []).reduce((sum, s) => sum + (s.mrr_cents ?? 0), 0);
  const activeCount = (activeSubs ?? []).length;
  const churned = recentChurnCount ?? 0;
  const churnRate = activeCount + churned > 0 ? (churned / (activeCount + churned)) * 100 : 0;

  return {
    totalBusinesses: totalBusinesses ?? 0,
    totalUsers: totalUsers ?? 0,
    verificationPending: verificationPending ?? 0,
    revenueCents: mrrCents + pastDueCents,
    mrrCents,
    churnRate,
  };
}

export async function getUpcomingMeetings() {
  const supabase = createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);
  return data ?? [];
}

export async function getActiveAlerts() {
  const supabase = createClient();
  const { data } = await supabase
    .from("department_alerts")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(6);
  return data ?? [];
}

export async function getRevenueSeries() {
  const supabase = createClient();
  const { data } = await supabase
    .from("revenue_snapshots")
    .select("*")
    .order("month", { ascending: true })
    .limit(12);
  return data ?? [];
}
