"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import api from "@/api/client";
import LectureDashboard from "@/components/classrooms/detail/LectureDashboard";
import Card from "@/components/ui/Card";

export default function LectureDetailPage() {
  const params = useParams();
  const classroomId = params?.id as string;
  const lessonId = params?.lessonId as string;

  const [classroomName, setClassroomName] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await api.get("/auth/me").catch(() => null);
      const myId = (me?.data?.id || "").toString().toLowerCase();
      const { data } = await api.get(`/classrooms/${classroomId}`);
      setClassroomName(String(data?.name ?? data?.Name ?? "Lớp học"));

      const members = (data?.Members ?? data?.members ?? []) as any[];
      const teacherByRole = members.some(
        (member: any) =>
          (member.Role || member.role) === "Teacher" &&
          ((member.UserId || member.userId || "").toString().toLowerCase() === myId)
      );
      const teacherByOwner = !!(data?.TeacherId && myId && String(data.TeacherId).toLowerCase() === myId);
      setIsTeacher(teacherByRole || teacherByOwner);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId) return;
    load();
  }, [classroomId, load]);

  if (loading) {
    return (
      <Card className="border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        Đang tải dashboard bài giảng...
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href={`/classrooms/${classroomId}?tab=lectures`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại mục lục bài giảng
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{classroomName || "Lớp học"}</h1>
        </div>
      </div>

      <LectureDashboard
        classroomId={classroomId}
        lessonId={lessonId}
        classroomName={classroomName}
        isTeacher={isTeacher}
      />
    </div>
  );
}
