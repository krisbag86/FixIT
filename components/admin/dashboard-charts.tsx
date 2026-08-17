"use client";

import { BarChart3, FileText } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { APP_TIME_ZONE } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "numeric",
    timeZone: APP_TIME_ZONE
  }).format(new Date(iso));
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !label) return null;
  return (
    <div className="rounded-md border border-black/10 bg-white px-3 py-2 shadow-md dark:border-white/10 dark:bg-ink">
      <div className="mb-1 text-xs font-bold">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-ink/60 dark:text-paper/60">{entry.name}:</span>
          <span className="font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      {/* Ticket Volume Chart */}
      <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
          <BarChart3 size={18} className="text-mint" />
          Liczba zgłoszeń (ostatnie 30 dni)
        </h2>
        {data.dailyTicketCounts.every((d) => d.created === 0 && d.resolved === 0) ? (
          <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">
            Brak danych do wyświetlenia wykresu.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={data.dailyTicketCounts}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-black/10 dark:stroke-white/10"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                className="text-ink/50 dark:text-paper/50"
              />
              <YAxis tick={{ fontSize: 11 }} className="text-ink/50 dark:text-paper/50" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="created"
                name="Utworzone"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                name="Rozwiązane"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Categories Chart */}
      <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
          <FileText size={18} className="text-mint" />
          Top kategorie
        </h2>
        {data.topCategories.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink/55 dark:text-paper/55">
            Brak danych.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data.topCategories}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-black/10 dark:stroke-white/10"
              />
              <XAxis type="number" tick={{ fontSize: 11 }} className="text-ink/50 dark:text-paper/50" />
              <YAxis
                dataKey="categoryName"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
                className="text-ink/50 dark:text-paper/50"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Zgłoszenia" fill="#06b6a2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
