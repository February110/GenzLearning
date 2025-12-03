"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import { toast } from "react-hot-toast";
import { HubConnectionState } from "@microsoft/signalr";
import { getSignalR } from "@/lib/signalr";

export type ChartPoint = { label: string; value: number };
export type HeatmapCell = { day: string; slot: string; value: number };
export type ActivityItem = { type: string; actor: string; action: string; context?: string | null; timestamp: string };
export type OverviewResponse = {
  totals: {
    users: number;
    classes: number;
    assignments: number;
    submissions: number;
    dailyVisits: number;
    weeklyVisits: number;
    growthRate: number;
  };
  charts: {
    submissionsPerMonth: ChartPoint[];
    loginsPerWeek: ChartPoint[];
    roleDistribution: ChartPoint[];
    activityHeatmap: HeatmapCell[];
  };
  activities: ActivityItem[];
  quality: {
    averageScore: number;
    completionRate: number;
    overdueAssignments: number;
    mostActiveClass: { id: string; name: string; submissions: number } | null;
  };
};

const emptyOverview: OverviewResponse = {
  totals: { users: 0, classes: 0, assignments: 0, submissions: 0, dailyVisits: 0, weeklyVisits: 0, growthRate: 0 },
  charts: { submissionsPerMonth: [], loginsPerWeek: [], roleDistribution: [], activityHeatmap: [] },
  activities: [],
  quality: { averageScore: 0, completionRate: 0, overdueAssignments: 0, mostActiveClass: null },
};

export default function useAdminOverview(pollIntervalMs = 30000) {
  const [overview, setOverview] = useState<OverviewResponse>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const hubBase = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    return base.replace(/\/api$/, "");
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/overview");
      setOverview(res.data);
    } catch {
      toast.error("Không thể tải dữ liệu tổng quan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    if (!pollIntervalMs) return;
    const id = setInterval(fetchOverview, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchOverview, pollIntervalMs]);

  useEffect(() => {
    const connection = getSignalR(hubBase, "/hubs/activity");
    const handler = (payload: ActivityItem) => {
      setOverview((prev) => ({
        ...prev,
        activities: [payload, ...prev.activities].slice(0, 20),
      }));
    };
    connection.on("ActivityUpdated", handler);
    if (connection.state === HubConnectionState.Disconnected) {
      connection.start().catch(() => {});
    }
    return () => {
      connection.off("ActivityUpdated", handler);
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch(() => {});
      }
    };
  }, [hubBase]);

  return { overview, loading, refresh: fetchOverview };
}
