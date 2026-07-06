"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { RevenueSnapshot } from "@/lib/types/database";

export function RevenueChart({ data }: { data: RevenueSnapshot[] }) {
  const chartData = data.map((row) => ({
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(row.month)),
    Revenue: row.revenue_cents / 100,
    MRR: row.mrr_cents / 100,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No revenue data yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#395EA1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#395EA1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#88C7E8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#88C7E8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(v) => `$${v}`}
            width={56}
          />
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString()}`}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
          />
          <Area
            type="monotone"
            dataKey="Revenue"
            stroke="#395EA1"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
          <Area
            type="monotone"
            dataKey="MRR"
            stroke="#88C7E8"
            strokeWidth={2}
            fill="url(#mrrFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
