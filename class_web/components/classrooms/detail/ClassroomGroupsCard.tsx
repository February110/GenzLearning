"use client";

import Card from "@/components/ui/Card";
import api from "@/api/client";
import { toast } from "react-hot-toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAvatar } from "@/utils/resolveAvatar";

interface ClassroomGroupsCardProps {
  classroomId: string;
  members: any[];
  isTeacher?: boolean;
  classGroupMode?: "student" | "random" | "none" | string;
  currentUserId?: string;
}

export default function ClassroomGroupsCard({
  classroomId,
  members,
  isTeacher = false,
  classGroupMode,
  currentUserId: currentUserIdProp,
}: ClassroomGroupsCardProps) {
  const normalized = members || [];
  const teachers = normalized.filter((m: any) => (m.Role || m.role) === "Teacher");
  const students = normalized.filter((m: any) => (m.Role || m.role) !== "Teacher");

  const initialMode = (() => {
    const raw = (classGroupMode || "").toString().toLowerCase();
    if (raw === "random") return "random";
    if (raw === "student") return "student";
    return "none";
  })();
  const [groupMode, setGroupMode] = useState<"student" | "random" | "none">(initialMode);
  const [pendingMode, setPendingMode] = useState<"student" | "random" | "none">(initialMode);
  const [groupList, setGroupList] = useState<any[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSize, setGroupSize] = useState(2);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLeaderId, setEditingLeaderId] = useState("");
  const [addingMemberId, setAddingMemberId] = useState("");

  const currentUserId = useMemo(() => {
    if (currentUserIdProp) return String(currentUserIdProp).toLowerCase();
    if (typeof window === "undefined") return "";
    try {
      const raw = JSON.parse(localStorage.getItem("user") || "{}");
      return (raw?.id || raw?.userId || raw?.Id || "").toString().toLowerCase();
    } catch {
      return "";
    }
  }, [currentUserIdProp]);

  const myGroup = useMemo(() => {
    if (!currentUserId) return null;
    return groupList.find((g: any) => {
      const members = (g.Members || g.members || []) as any[];
      return members.some((m) => String(m.UserId || m.userId).toLowerCase() === currentUserId);
    });
  }, [groupList, currentUserId]);

  const groupedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    groupList.forEach((g: any) => {
      const members = (g.Members || g.members || []) as any[];
      members.forEach((m) => {
        const id = String(m.UserId || m.userId || "").toLowerCase();
        if (id) ids.add(id);
      });
    });
    return ids;
  }, [groupList]);

  const availableStudents = useMemo(() => {
    return students.filter((m: any) => {
      const id = String(m.UserId || m.userId || "").toLowerCase();
      return id && !groupedStudentIds.has(id);
    });
  }, [students, groupedStudentIds]);

  useEffect(() => {
    const raw = (classGroupMode || "").toString().toLowerCase();
    const next = raw === "random" ? "random" : raw === "student" ? "student" : "none";
    setGroupMode(next);
    setPendingMode(next);
  }, [classGroupMode]);

  useEffect(() => {
    if (!editingGroupId) return;
    const exists = groupList.some((g: any) => String(g.Id || g.id) === editingGroupId);
    if (!exists) {
      setEditingGroupId(null);
      setEditingName("");
      setEditingLeaderId("");
      setAddingMemberId("");
    }
  }, [groupList, editingGroupId]);

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
    if (!groupName.trim()) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups`, {
        name: groupName.trim(),
      });
      toast.success("Đã tạo nhóm.");
      setGroupName("");
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

  function startEditGroup(group: any) {
    const id = String(group.Id || group.id || "");
    if (!id) return;
    setEditingGroupId(id);
    setEditingName(group.Name || group.name || "");
    setEditingLeaderId(String(group.LeaderId || group.leaderId || ""));
    setAddingMemberId("");
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setEditingName("");
    setEditingLeaderId("");
    setAddingMemberId("");
  }

  async function handleSaveGroup(groupId: string) {
    const name = editingName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên nhóm.");
      return;
    }
    try {
      setGroupBusy(true);
      await api.patch(`/classrooms/${classroomId}/groups/${groupId}`, {
        name,
        leaderId: editingLeaderId || undefined,
      });
      toast.success("Đã cập nhật nhóm.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Cập nhật nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleAddMember(groupId: string) {
    if (!addingMemberId) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups/${groupId}/members`, {
        userId: addingMemberId,
      });
      toast.success("Đã thêm thành viên.");
      setAddingMemberId("");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Thêm thành viên thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleRemoveMember(groupId: string, userId: string, isLeader: boolean) {
    if (!userId) return;
    if (isLeader && !confirm("Xóa trưởng nhóm sẽ chuyển quyền cho người khác. Bạn chắc chứ?")) return;
    try {
      setGroupBusy(true);
      await api.delete(`/classrooms/${classroomId}/groups/${groupId}/members/${userId}`);
      toast.success("Đã cập nhật nhóm.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Xóa thành viên thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleJoinGroup(groupId: string) {
    if (!groupId || groupBusy) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups/${groupId}/join`);
      toast.success("Đã tham gia nhóm.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Tham gia nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleLeaveGroup(groupId: string) {
    if (!groupId || groupBusy) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups/${groupId}/leave`);
      toast.success("Đã rời nhóm.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Rời nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleRandomizeGroups() {
    if (!classroomId || groupBusy) return;
    try {
      setGroupBusy(true);
      await api.post(`/classrooms/${classroomId}/groups/randomize`, {
        groupSize: Number(groupSize) || 2,
      });
      toast.success("Đã chia nhóm ngẫu nhiên.");
      await loadGroups();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Chia nhóm thất bại";
      toast.error(msg);
    } finally {
      setGroupBusy(false);
    }
  }

  async function handleUpdateMode(next: "student" | "random") {
    if (groupBusy || next === groupMode) return;
    try {
      setGroupBusy(true);
      await api.patch(`/classrooms/${classroomId}/group-mode`, { mode: next });
      setGroupMode(next);
      setPendingMode(next);
      toast.success("Đã cập nhật hình thức chia nhóm.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Cập nhật thất bại";
      toast.error(msg);
      setPendingMode(groupMode);
    } finally {
      setGroupBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Nhóm</h2>
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
          {groupMode === "none" && (
            <div className="text-xs text-gray-500">
              Chưa bật chia nhóm cho lớp này. Hãy chọn hình thức để bắt đầu.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="classGroupMode"
                checked={pendingMode === "student"}
                onChange={() => setPendingMode("student")}
              />
              Học viên tự xếp nhóm
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="classGroupMode"
                checked={pendingMode === "random"}
                onChange={() => setPendingMode("random")}
              />
              Giáo viên xếp nhóm ngẫu nhiên
            </label>
            <button
              type="button"
              disabled={groupBusy || pendingMode === groupMode}
              onClick={() => handleUpdateMode(pendingMode === "none" ? "student" : pendingMode)}
              className="rounded-full border border-indigo-200 text-indigo-700 px-4 py-1.5 text-sm hover:bg-indigo-50 disabled:opacity-60"
            >
              Xác nhận
            </button>
          </div>
          {pendingMode === "random" && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-gray-500">Số thành viên mỗi nhóm</label>
                <input
                  type="number"
                  min={1}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value) || 1)}
                  className="w-28 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleRandomizeGroups}
                disabled={groupBusy || groupMode !== "random"}
                className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                Chia nhóm ngẫu nhiên
              </button>
            </div>
          )}
          {groupMode === "student" && (
            <div className="text-xs text-gray-500">
              Học viên có thể tự tạo nhóm và tham gia nhóm trong tab Nhóm. Giáo viên vẫn có thể chỉnh sửa thủ công khi cần.
            </div>
          )}
        </div>
      )}
      {!isTeacher && groupMode === "none" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 p-4">
          <div className="text-sm text-gray-600">Giáo viên chưa bật chia nhóm cho lớp này.</div>
        </div>
      )}
      {!isTeacher && groupMode === "random" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 p-4">
          <div className="text-sm text-gray-600">Giáo viên sẽ chia nhóm ngẫu nhiên cho lớp này.</div>
        </div>
      )}
      {!isTeacher && groupMode === "student" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nhóm lớp</div>
          {myGroup ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm">
              <div>
                <div className="font-semibold">{myGroup.Name || myGroup.name || "Nhóm"}</div>
                <div className="text-xs text-gray-500">Bạn đã tham gia nhóm này.</div>
              </div>
              <button
                type="button"
                onClick={() => handleLeaveGroup(String(myGroup.Id || myGroup.id))}
                disabled={groupBusy}
                className="text-xs text-rose-600 hover:underline"
              >
                Rời nhóm
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Tạo nhóm mới</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ví dụ: Nhóm 1"
                  className="flex-1 min-w-[220px] rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={groupBusy || !groupName.trim()}
                  className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  Tạo nhóm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {groupMode !== "none" && (
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
                const isMember =
                  !!currentUserId &&
                  members.some((m) => String(m.UserId || m.userId).toLowerCase() === currentUserId);
                const groupId = String(g.Id || g.id || idx);
                const isEditing = editingGroupId === groupId;
                return (
                  <div
                    key={groupId}
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
                        {isTeacher ? (
                          <>
                            <button
                              type="button"
                              onClick={() => (isEditing ? cancelEditGroup() : startEditGroup(g))}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {isEditing ? "Hủy" : "Sửa"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(String(g.Id || g.id))}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Xóa
                            </button>
                          </>
                        ) : groupMode === "student" && !myGroup && !isMember ? (
                          <button
                            type="button"
                            disabled={groupBusy}
                            onClick={() => handleJoinGroup(String(g.Id || g.id))}
                            className="text-xs text-indigo-600 hover:underline disabled:opacity-60"
                          >
                            Tham gia
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {isTeacher && isEditing && (
                      <div className="mt-3 space-y-3 rounded-lg border border-gray-200/70 dark:border-gray-800/70 bg-gray-50/60 dark:bg-zinc-900 px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="text-xs text-gray-500">Tên nhóm</label>
                            <input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="mt-1 w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                              disabled={groupBusy}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Trưởng nhóm</label>
                            <select
                              value={editingLeaderId}
                              onChange={(e) => setEditingLeaderId(e.target.value)}
                              className="mt-1 w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                              disabled={groupBusy}
                            >
                              {members.map((m: any, mIdx: number) => {
                                const memberId = String(m.UserId || m.userId || "");
                                const memberName = m.FullName || m.fullName || m.Email || m.email || `Thành viên ${mIdx + 1}`;
                                return (
                                  <option key={memberId || mIdx} value={memberId}>
                                    {memberName}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[220px]">
                            <label className="text-xs text-gray-500">Thêm thành viên</label>
                            <select
                              value={addingMemberId}
                              onChange={(e) => setAddingMemberId(e.target.value)}
                              className="mt-1 w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                              disabled={groupBusy || availableStudents.length === 0}
                            >
                              <option value="">Chọn học viên</option>
                              {availableStudents.map((m: any, mIdx: number) => {
                                const id = String(m.UserId || m.userId || "");
                                const label = m.FullName || m.fullName || m.Email || m.email || `Học viên ${mIdx + 1}`;
                                return (
                                  <option key={id || mIdx} value={id}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMember(groupId)}
                            disabled={groupBusy || !addingMemberId}
                            className="rounded-full border border-indigo-200 text-indigo-700 px-4 py-2 text-sm hover:bg-indigo-50 disabled:opacity-60"
                          >
                            Thêm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveGroup(groupId)}
                            disabled={groupBusy}
                            className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
                          >
                            Lưu thay đổi
                          </button>
                        </div>
                      </div>
                    )}
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
                            {isTeacher && isEditing && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(groupId, String(m.UserId || m.userId), isLeader)
                                }
                                className="text-[10px] text-rose-600 hover:underline"
                                disabled={groupBusy}
                              >
                                Gỡ
                              </button>
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
      )}
    </Card>
  );
}
