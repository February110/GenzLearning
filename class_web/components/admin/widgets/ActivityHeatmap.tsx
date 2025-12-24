"use client";

type Cell = { day: string; slot: string; value: number };

export default function ActivityHeatmap({ data }: { data: Cell[] }) {
  const dayLabels = Array.from(new Set(data.map((d) => d.day)));
  const slotLabels = Array.from(new Set(data.map((d) => d.slot)));
  const map = new Map(data.map((cell) => [`${cell.day}-${cell.slot}`, cell.value]));
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-700 font-semibold">Hoạt động cao điểm</p>
        <div className="text-sm text-slate-500">Theo khung giờ</div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-2 py-2 text-left">Khung giờ</th>
                {dayLabels.map((day) => (
                  <th key={day} className="px-2 py-2 text-center">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotLabels.map((slot) => (
                <tr key={slot}>
                  <td className="px-2 py-2 font-medium text-slate-600 dark:text-slate-300">{slot}</td>
                  {dayLabels.map((day) => {
                    const value = map.get(`${day}-${slot}`) ?? 0;
                    const ratio = value / maxValue;
                    const background = `rgba(99, 102, 241, ${0.12 + ratio * 0.7})`;
                    const textColor = ratio > 0.5 ? "text-white" : "text-indigo-900 dark:text-indigo-100";
                    return (
                      <td key={`${day}-${slot}`} className="px-2 py-2 text-center">
                        <div className={`rounded-md py-2 ${textColor}`} style={{ backgroundColor: background }}>
                          {value}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
