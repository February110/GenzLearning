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
    colors: ["#6366F1", "#60A5FA"],
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
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-700 font-semibold">Cơ cấu tài khoản</p>
        <div className="text-sm text-slate-500">Giáo viên vs học viên</div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có dữ liệu phân bổ.</p>
      ) : (
        <ReactApexChart options={options} series={series} type="donut" height={280} />
      )}
    </div>
  );
}
