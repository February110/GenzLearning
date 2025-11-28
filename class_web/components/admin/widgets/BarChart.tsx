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
      labels: { style: { colors: "#9CA3AF" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#9CA3AF" } } },
    grid: { borderColor: "#E5E7EB", strokeDashArray: 4 },
    colors: ["#6366F1"],
    legend: { show: false },
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Lượt đăng nhập</p>
          <div className="text-sm text-gray-500">Theo tuần</div>
        </div>
        <div className="text-xs text-gray-400">8 tuần gần nhất</div>
      </div>
      <ReactApexChart options={options} series={series} type="bar" height={280} />
    </div>
  );
}
