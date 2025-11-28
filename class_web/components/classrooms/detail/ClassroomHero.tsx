"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { BookOpen, Clipboard, Megaphone, Plus, Settings, Users } from "lucide-react";
import React from "react";

interface ClassroomHeroProps {
  classroom: any;
  bannerUrl: string;
  inviteVisible: boolean;
  isTeacher: boolean;
  onCopyInvite: () => void;
  onToggleSettings: () => void;
  onCreateAssignment: () => void;
  onCreateAnnouncement: () => void;
}

function getInitials(name: string) {
  try {
    return (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  } catch {
    return "?";
  }
}

export default function ClassroomHero({
  classroom,
  bannerUrl,
  inviteVisible,
  isTeacher,
  onCopyInvite,
  onToggleSettings,
  onCreateAssignment,
  onCreateAnnouncement,
}: ClassroomHeroProps) {
  const assignmentsCount = (classroom?.assignments || []).length;
  const membersCount = ((classroom as any)?.Members || (classroom as any)?.members || []).length;

  return (
    <Card className="overflow-hidden">
      <div className="relative h-56 md:h-72">
        <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-lg font-semibold">
                {getInitials(classroom?.name || "L")}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">{classroom?.name}</h1>
                <p
                  className="text-white/90"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {classroom?.description || "Không có mô tả"}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCopyInvite}
                  disabled={!inviteVisible}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${
                    inviteVisible ? "bg-white/90 hover:bg-white text-indigo-700" : "bg-white/80 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Clipboard className="h-4 w-4" />
                  {inviteVisible ? (
                    <>
                      Mã mời: <b className="font-mono text-indigo-700">{classroom?.inviteCode}</b>
                    </>
                  ) : (
                    <>Mã mời đã bị ẩn</>
                  )}
                </button>
                {isTeacher && (
                  <button
                    type="button"
                    title="Cài đặt lớp"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSettings();
                    }}
                    className="inline-flex items-center justify-center bg-white/90 hover:bg-white text-indigo-700 rounded-md p-1.5 shadow"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded-md">
                  <BookOpen className="h-4 w-4" />
                  {assignmentsCount} bài tập
                </span>
                <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded-md">
                  <Users className="h-4 w-4" />
                  {membersCount} thành viên
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute left-6 bottom-5 flex flex-wrap items-center gap-2">
          {isTeacher && (
            <>
              <Button variant="primary" size="md" onClick={onCreateAssignment}>
                <Plus className="h-4 w-4 mr-2" /> Tạo bài tập
              </Button>
              <Button variant="secondary" size="md" onClick={onCreateAnnouncement}>
                <Megaphone className="h-4 w-4 mr-2" /> Tạo thông báo
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
