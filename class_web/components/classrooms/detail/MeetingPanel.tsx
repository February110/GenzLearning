"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Calendar, Clock4, Video, XCircle } from "lucide-react";

interface MeetingPanelProps {
  meeting: any | null;
  history?: any[] | null;
  classroomName?: string;
  isTeacher: boolean;
  meetingBusy?: boolean;
  onStart: (title?: string) => void;
  onJoin: (roomCode?: string) => void;
  onEnd: () => void;
}

export default function MeetingPanel({
  meeting,
  history = [],
  classroomName,
  isTeacher,
  meetingBusy = false,
  onStart,
  onJoin,
  onEnd,
}: MeetingPanelProps) {
  const meetingId = meeting?.id ?? meeting?.Id;
  const roomCode = meeting?.roomCode ?? meeting?.RoomCode;
  const startedAt = meeting?.startedAt ?? meeting?.StartedAt;

  const formatToLocal = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  };

  const startedDisplay = formatToLocal(startedAt);
  const historyList = Array.isArray(history) ? history : [];
  const formatDate = (value?: string | null) => formatToLocal(value);
  const [titleInput, setTitleInput] = useState("");

  const suggestedTitle = useMemo(() => {
    const name = classroomName || "Buổi học";
    return name;
  }, [classroomName]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6 space-y-8 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cuộc họp trực tuyến</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Giáo viên mở phòng họp và chia sẻ mã phòng, học viên dùng mã này để tham gia nhanh chóng.
        </p>
      </div>

      {meetingId ? (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/30 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-500/10 dark:to-transparent p-5 shadow-inner space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                Phòng đang hoạt động
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {meeting?.title ?? meeting?.Title ?? "Không tên"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Mã phòng</p>
              <p className="font-mono text-2xl text-gray-900 dark:text-white">{roomCode}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Bắt đầu lúc {startedDisplay}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={meetingBusy} onClick={() => onJoin(roomCode)}>
              <Video className="h-4 w-4 mr-2" /> Tham gia phòng
            </Button>
            {isTeacher && (
              <Button variant="danger" disabled={meetingBusy} onClick={onEnd}>
                <XCircle className="h-4 w-4 mr-2" /> Kết thúc cuộc họp
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-5 flex flex-col gap-4 bg-gray-50 dark:bg-zinc-900/40">
          <div>
            <p className="text-base font-semibold text-gray-800 dark:text-white">Chưa có phòng họp nào đang hoạt động</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isTeacher ? "Tạo phòng mới để bắt đầu buổi học trực tuyến ngay trong lớp này." : "Chờ giáo viên mở phòng, bạn sẽ thấy mã phòng ở đây để tham gia."}
            </p>
          </div>
          {isTeacher && (
            <div className="space-y-2 w-full sm:max-w-lg">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chủ đề cuộc họp</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={suggestedTitle}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
                <Button
                  variant="primary"
                  disabled={meetingBusy}
                  onClick={() => {
                    const chosen = titleInput.trim() || suggestedTitle;
                    setTitleInput("");
                    onStart(chosen);
                  }}
                >
                  <Video className="h-4 w-4 mr-2" /> Bắt đầu cuộc họp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nhật ký cuộc họp</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Danh sách các cuộc họp đã diễn ra gần đây.</p>
        </div>

        {historyList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400">
            Chưa có cuộc họp nào trước đó.
          </div>
        ) : (
          <div className="space-y-6">
            {historyList.map((item: any, idx: number) => {
              const started = item?.startedAt ?? item?.StartedAt ?? null;
              const ended = item?.endedAt ?? item?.EndedAt ?? null;
              const status = String(item?.status ?? item?.Status ?? "ended").toLowerCase();
              const title = item?.title ?? item?.Title ?? `Buổi họp #${idx + 1}`;
              const code = item?.roomCode ?? item?.RoomCode ?? "—";
              const duration =
                started && ended
                  ? Math.max(1, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000))
                  : null;
              const statusLabel =
                status === "ended" ? "Đã kết thúc" : status === "cancelled" ? "Đã huỷ" : "Đã đóng";
              const statusClass =
                status === "ended"
                  ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                  : status === "cancelled"
                  ? "text-red-600 bg-red-50 dark:bg-red-500/10"
                  : "text-amber-600 bg-amber-50 dark:bg-amber-500/10";

              const key = item?.id ?? item?.Id ?? `${code}-${started ?? Math.random()}`;

              return (
                <div key={key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="h-3 w-3 rounded-full bg-indigo-500 mt-1" />
                    {idx < historyList.length - 1 && (
                      <span className="flex-1 border-l border-dashed border-gray-300 dark:border-gray-700" />
                    )}
                  </div>
                  <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(started)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock4 className="h-3 w-3" /> Kết thúc: {formatDate(ended)}
                        </p>
                        {duration && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Thời lượng: {duration} phút</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          {statusLabel}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Mã phòng: <span className="font-mono text-gray-900 dark:text-gray-100">{code}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
