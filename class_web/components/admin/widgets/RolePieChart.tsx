"use client";

import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function RolePieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const options: any = {
    chart: { type: "donut" },
    labels: data.map((d) => d.label),
    dataLabels: { enabled: false },
    legend: { position: "bottom" },
    colors: ["#0ea5e9", "#f97316"],
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Tổng",
              formatter: () => `${total}`,
            },
          },
        },
      },
    },
  };

  const series = data.map((d) => d.value);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-gray-700 font-semibold">Cơ cấu tài khoản</p>
        <div className="text-sm text-gray-500">Giáo viên vs học viên</div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có dữ liệu phân bổ.</p>
      ) : (
        <ReactApexChart options={options} series={series} type="donut" height={280} />
      )}
    </div>
  );
}
