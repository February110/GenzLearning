"use client";

import Link from "next/link";
import AreaChart from "@/components/admin/widgets/AreaChart";
import BarChart from "@/components/admin/widgets/BarChart";
import RolePieChart from "@/components/admin/widgets/RolePieChart";
import ActivityHeatmap from "@/components/admin/widgets/ActivityHeatmap";
import useAdminOverview from "@/hooks/useAdminOverview";
import { Activity, ArrowLeft } from "lucide-react";

export default function AdminAnalyticsPage() {
  const { overview, loading } = useAdminOverview();

  return (
    <div className="space-y-6">
    
      <div className="grid gap-4 xl:grid-cols-2">
        <AreaChart data={overview.charts.submissionsPerMonth} />
        <BarChart data={overview.charts.loginsPerWeek} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RolePieChart data={overview.charts.roleDistribution} />
        <ActivityHeatmap data={overview.charts.activityHeatmap} />
      </div>
    </div>
  );
}
