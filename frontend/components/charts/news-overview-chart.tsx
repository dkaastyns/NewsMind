"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { day: "Sen", article: 18, positive: 12, neutral: 5, negative: 1 },
  { day: "Sel", article: 24, positive: 14, neutral: 8, negative: 2 },
  { day: "Rab", article: 28, positive: 18, neutral: 8, negative: 2 },
  { day: "Kam", article: 31, positive: 19, neutral: 10, negative: 2 },
  { day: "Jum", article: 26, positive: 16, neutral: 8, negative: 2 },
  { day: "Sab", article: 20, positive: 13, neutral: 6, negative: 1 },
];

export function NewsOverviewChart() {
  return (
    <div className="glass-card h-[340px] rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Activity
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">News per Day</h3>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          +12% this week
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="articleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef629f" stopOpacity={0.32} />
              <stop offset="95%" stopColor="#ef629f" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} stroke="#64748b" />
          <YAxis tickLine={false} axisLine={false} stroke="#64748b" />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.92)",
              borderRadius: 16,
              border: "1px solid rgba(226,232,240,0.9)",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="article"
            stroke="#ef629f"
            strokeWidth={3}
            fill="url(#articleFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
