"use client";

import Card from "@/components/ui/Card";
import api from "@/api/client";
import { toast } from "react-hot-toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAvatar } from "@/utils/resolveAvatar";

interface MembersCardProps {
  classroomId: string;
  members: any[];
  isTeacher?: boolean;
}

export default function MembersCard({ classroomId, members, isTeacher = false }: MembersCardProps) {
  const normalized = members || [];
  const teachers = normalized.filter((m: any) => (m.Role || m.role) === "Teacher");
  const students = normalized.filter((m: any) => (m.Role || m.role) !== "Teacher");
  const studentOptions = useMemo(() => {
    return students
      .map((s: any) => {
        const id = (s.UserId ?? s.userId ?? "").toString();
        if (!id) return null;
        return {
          id,
          name: s.FullName || s.fullName || s.Email || s.email || "Học viên",
          email: s.Email || s.email || "",
          avatar: getAvatar(s),
        };
      })
      .filter(Boolean) as { id: string; name: string; email: string; avatar?: string }[];
  }, [students]);
  const [groupList, setGroupList] = useState<any[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupLeaderId, setGroupLeaderId] = useState("");

  const loadGroups = useCallback(
    async () => {
      try {
        setGroupLoading(true);
        setGroupError(null);
        const { data } = await api.get(`/classrooms/${classroomId}/groups`);
        const list = Array.isArray(data) ? data : data?.groups ?? [];
        setGroupList(Array.isArray(list) ? list : []);
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Không thể tải danh sách nhóm";
        setGroupError(msg);
        setGroupList([]);
      } finally {
        setGroupLoading(false);
      }
    },
    [classroomId]
  );

  useEffect(() => {
    if (!classroomId) return;
    loadGroups();
  }, [classroomId, loadGroups]);

  useEffect(() => {
    if (groupMemberIds.length === 0) {
      setGroupLeaderId("");
      return;
    }
    if (!groupMemberIds.includes(groupLeaderId)) {
      setGroupLeaderId(groupMemberIds[0]);
    }
  }, [groupMemberIds, groupLeaderId]);

  function getInitials(name?: string) {
    if (!name) return "??";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function getAvatar(member: any) {
    const raw =
      member?.Avatar ||
      member?.avatar ||
      member?.User?.Avatar ||
      member?.user?.avatar ||
      member?.photoUrl ||
      member?.PhotoUrl ||
      member?.image ||
      member?.picture;
    if (!raw) return undefined;
    return resolveAvatar(raw) || raw;
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || groupMemberIds.length === 0 || !groupLeaderId) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups`, {
        name: groupName.trim(),
        leaderId: groupLeaderId,
        memberIds: groupMemberIds,
      });
      toast.success("Đã tạo nhóm.");
      setGroupName("");
      setGroupMemberIds([]);
      setGroupLeaderId("");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Tạo nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!groupId) return;
    if (!confirm("Bạn có chắc muốn xóa nhóm này?")) return;
    try {
      setGroupBusy(true);
      await api.delete(`/classrooms/${classroomId}/groups/${groupId}`);
      toast.success("Đã xóa nhóm.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Xóa nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Thành viên</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {normalized.length} người tham gia · {teachers.length} giáo viên · {students.length} học viên
          </p>
        </div>
      </div>
      {isTeacher && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nhóm lớp</div>
          </div>
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="text-xs text-gray-500">Tên nhóm</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ví dụ: Nhóm 1"
                className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Chọn thành viên</div>
              <div className="grid sm:grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                {studentOptions.length === 0 && (
                  <div className="text-xs text-gray-500">Chưa có học viên để thêm.</div>
                )}
                {studentOptions.map((s) => {
                  const checked = groupMemberIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setGroupMemberIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                          );
                        }}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
              <div>
                <label className="text-xs text-gray-500">Trưởng nhóm</label>
                <select
                  value={groupLeaderId}
                  onChange={(e) => setGroupLeaderId(e.target.value)}
                  className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="">Chọn trưởng nhóm</option>
                  {studentOptions
                    .filter((s) => groupMemberIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={groupBusy || !groupName.trim() || groupMemberIds.length === 0 || !groupLeaderId}
                className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Danh sách nhóm</div>
            {groupLoading ? (
              <div className="text-xs text-gray-500">Đang tải danh sách nhóm...</div>
            ) : groupError ? (
              <div className="text-xs text-rose-600">{groupError}</div>
            ) : groupList.length === 0 ? (
              <div className="text-xs text-gray-500">Chưa có nhóm nào trong lớp.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {groupList.map((g: any, idx: number) => {
                  const members = (g.Members || g.members || []) as any[];
                  const name = g.Name || g.name || `Nhóm ${idx + 1}`;
                  const leaderId = g.LeaderId || g.leaderId;
                  const leaderName = g.LeaderName || g.leaderName;
                  return (
                    <div
                      key={g.Id || g.id || idx}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</div>
                          {(leaderName || leaderId) && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Trưởng nhóm: {leaderName || "—"}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-500">{members.length} thành viên</div>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(String(g.Id || g.id))}
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {members.length === 0 && (
                          <div className="text-xs text-gray-500">Chưa có thành viên.</div>
                        )}
                        {members.map((m: any, mIdx: number) => {
                          const role = (m.Role || m.role || "").toLowerCase();
                          const isLeader = role === "leader" || String(m.UserId || m.userId) === String(leaderId);
                          const displayName = m.FullName || m.fullName || m.Email || m.email || "Thành viên";
                          const avatar = getAvatar(m);
                          return (
                            <div key={m.UserId || m.userId || mIdx} className="flex items-center gap-2">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={displayName}
                                  className="h-7 w-7 rounded-full object-cover border border-white/40"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-[10px] font-semibold">
                                  {getInitials(displayName)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                                  {displayName}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">{m.Email || m.email || "—"}</div>
                              </div>
                              {isLeader && (
                                <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                                  Trưởng nhóm
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {teachers.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Giáo viên</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {teachers.map((m: any, idx: number) => (
              <div
                key={`teacher-${m.UserId || m.userId || idx}`}
                className="flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-900/20 px-4 py-3"
              >
                {getAvatar(m) ? (
                  <img
                    src={getAvatar(m)}
                    alt={m.FullName || m.fullName || "Teacher"}
                    className="h-10 w-10 rounded-full object-cover border border-white/40"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                    {getInitials(m.FullName || m.fullName || "")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {m.FullName || m.fullName}
                  </div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-200">Teacher</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Học viên ({students.length})
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Sắp xếp theo tên</span>
        </div>
        {students.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">Chưa có học viên nào.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {students.map((m: any, idx: number) => (
              <div
                key={`student-${m.UserId || m.userId || idx}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 px-4 py-3 shadow-sm"
              >
                {getAvatar(m) ? (
                  <img
                    src={getAvatar(m)}
                    alt={m.FullName || m.fullName || "Member"}
                    className="h-9 w-9 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-semibold">
                    {getInitials(m.FullName || m.fullName || m.Email || m.email)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {m.FullName || m.fullName || "Không rõ"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{m.Email || m.email || "—"}</div>
                </div>
                <span className="text-[11px] uppercase tracking-wide rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                  Student
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
