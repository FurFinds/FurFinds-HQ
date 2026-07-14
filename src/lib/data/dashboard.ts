import { createClient } from "@/lib/supabase/server";

export interface DashboardMetrics {
  totalBusinesses: number;
  totalUsers: number;
  verificationPending: number;
  activeSubscriptions: number;
  canceledSubscriptions30d: number;
  churnRate: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();

  const [
    { count: totalBusinesses },
    { count: totalUsers },
    { count: verificationPending },
    { count: activeSubscriptions },
    { count: canceledSubscriptions30d },
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .in("verification_status", ["pending", "in_progress"]),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "canceled")
      .gte("end_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const active = activeSubscriptions ?? 0;
  const churned = canceledSubscriptions30d ?? 0;
  const churnRate = active + churned > 0 ? (churned / (active + churned)) * 100 : 0;

  return {
    totalBusinesses: totalBusinesses ?? 0,
    totalUsers: totalUsers ?? 0,
    verificationPending: verificationPending ?? 0,
    activeSubscriptions: active,
    canceledSubscriptions30d: churned,
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
