"use client";

import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function AreaChart({ data }: { data: { label: string; value: number }[] }) {
  const categories = data.length ? data.map((d) => d.label) : ["-"];
  const values = data.length ? data.map((d) => d.value) : [0];
  const series = [{ name: "Bài nộp", data: values }];

  const options: any = {
    chart: { toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] },
    },
    xaxis: {
      categories,
      labels: { style: { colors: "#94A3B8" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#94A3B8" } } },
    grid: { borderColor: "#E2E8F0", strokeDashArray: 4 },
    theme: { mode: typeof window !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light" },
    colors: ["#6366F1"],
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-700 font-semibold">Lượt nộp bài</p>
          <div className="text-sm text-slate-500">Theo tháng</div>
        </div>
        <div className="text-xs text-slate-400">6 tháng gần nhất</div>
      </div>
      <ReactApexChart options={options} series={series} type="area" height={280} />
    </div>
  );
}
