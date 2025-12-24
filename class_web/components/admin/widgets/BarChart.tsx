"use client";

import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const categories = data.length ? data.map((d) => d.label) : ["-"];
  const values = data.length ? data.map((d) => d.value) : [0];
  const series = [{ name: "Lượt đăng nhập", data: values }];

  const options: any = {
    chart: { stacked: false, toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "45%" } },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { colors: "#94A3B8" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#94A3B8" } } },
    grid: { borderColor: "#E2E8F0", strokeDashArray: 4 },
    colors: ["#6366F1"],
    legend: { show: false },
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-700 font-semibold">Lượt đăng nhập</p>
          <div className="text-sm text-slate-500">Theo tuần</div>
        </div>
        <div className="text-xs text-slate-400">8 tuần gần nhất</div>
      </div>
      <ReactApexChart options={options} series={series} type="bar" height={280} />
    </div>
  );
}
