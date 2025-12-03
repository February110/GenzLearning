"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import Link from "next/link";

type Classroom = { classroomId: string; name: string; role?: string };
type Assignment = { id: string; title: string; dueAt?: string | null };

type EventItem = {
  id: string;
  title: string;
  date: Date;
  classroom: string;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function fmtMonth(d: Date) {
  return d.toLocaleString("vi-VN", { month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: classes }: { data: Classroom[] } = await api.get("/classrooms");
        const list: EventItem[] = [];
        const studentClasses = (classes || []).filter((c) => (c.role || "").toLowerCase() !== "teacher");
        for (const c of studentClasses) {
          try {
            const { data: as }: { data: Assignment[] } = await api.get(`/assignments/classroom/${c.classroomId}`);
            as.forEach((a) => {
              const dueStr = (a as any).dueAt || (a as any).DueAt;
              if (!dueStr) return;
              const date = new Date(dueStr);
              if (isNaN(date.getTime())) return;
              list.push({ id: a.id, title: a.title, date, classroom: c.name });
            });
          } catch {}
        }
        setEvents(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const monthDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days: Date[] = [];
    // Previous offset to start on Monday (or Sunday?). We'll use Sunday start matching screenshot.
    const offset = start.getDay(); // 0..6, Sunday=0
    for (let i = 0; i < offset; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (offset - i));
      days.push(d);
    }
    for (let d = 1; d <= end.getDate(); d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));
    // Fill to 6 rows (42 cells)
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      days.push(d);
    }
    return days;
  }, [month]);

  const eventsByDay = useMemo(() => {
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const map = new Map<string, EventItem[]>();
    events.forEach((e) => {
      const k = key(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  const isSameMonth = (d: Date) => d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  const isToday = (d: Date) => d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lịch hạn nộp</h1>
          <div className="text-sm text-gray-500">Các hạn bài tập trên tất cả lớp của bạn</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">Tháng trước</button>
          <div className="px-3 py-1 text-sm font-medium">{fmtMonth(month)}</div>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">Tháng sau</button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="grid grid-cols-7 bg-indigo-600 text-white text-sm">
          {['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'].map(label => (
            <div key={label} className="px-3 py-2 font-medium">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDays.map((d, i) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const list = eventsByDay.get(key) || [];
            const isCur = isSameMonth(d);
            return (
              <div key={i} className={"h-28 border-t border-l border-gray-100 dark:border-gray-900 p-2 " + (isCur ? "bg-white dark:bg-zinc-950" : "bg-gray-50 dark:bg-zinc-900/40 text-gray-400") }>
                <div className={"text-xs font-medium w-6 h-6 grid place-items-center rounded-full " + (isToday(d) && isCur ? "bg-indigo-600 text-white" : "")}>{d.getDate()}</div>
                <div className="mt-1 space-y-1 max-h-20 overflow-y-auto pr-1 scrollbar-thin">
                  {list
                    .filter(e => isSameMonth(month))
                    .map((e) => (
                      <Link key={e.id} href={`/assignments/${e.id}`} className="block rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-2 py-1">
                        <div className="text-[12px] font-medium truncate">{e.title}</div>
                        <div className="text-[11px] text-gray-500 truncate">{e.classroom}</div>
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!loading && events.length === 0 && (
        <div className="text-center text-gray-500">Chưa có hạn nộp nào.</div>
      )}
    </div>
  );
}
