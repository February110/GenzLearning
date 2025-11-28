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
      labels: { style: { colors: "#9CA3AF" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#9CA3AF" } } },
    grid: { borderColor: "#E5E7EB", strokeDashArray: 4 },
    theme: { mode: typeof window !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light" },
    colors: ["#14b8a6"],
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Lượt nộp bài</p>
          <div className="text-sm text-gray-500">Theo tháng</div>
        </div>
        <div className="text-xs text-gray-400">6 tháng gần nhất</div>
      </div>
      <ReactApexChart options={options} series={series} type="area" height={280} />
    </div>
  );
}
