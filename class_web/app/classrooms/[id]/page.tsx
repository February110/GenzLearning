"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import { toast } from "react-hot-toast";
import useClassroomRealtime from "@/hooks/useClassroomRealtime";
import AnnouncementsPanel from "@/components/classrooms/detail/AnnouncementsPanel";
import AnnouncementModal from "@/components/classrooms/detail/AnnouncementModal";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import ClassroomHero from "@/components/classrooms/detail/ClassroomHero";
import ClassroomSettingsSheet from "@/components/classrooms/detail/ClassroomSettingsSheet";
import AssignmentsCard from "@/components/classrooms/detail/AssignmentsCard";
import MembersCard from "@/components/classrooms/detail/MembersCard";
import AssignmentCreateModal from "@/components/classrooms/detail/AssignmentCreateModal";
import AssignmentEditModal from "@/components/classrooms/detail/AssignmentEditModal";
import ClassroomTabMenu, { type TabItem } from "@/components/classrooms/detail/ClassroomTabMenu";
import GradesTable from "@/components/classrooms/detail/GradesTable";
import MeetingPanel from "@/components/classrooms/detail/MeetingPanel";

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params?.id as string;
  const router = useRouter();

  const [classroom, setClassroom] = useState<any>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceDraft, setAnnounceDraft] = useState<{ sourceId: string; content: string; materials?: any[]; copyAttachments?: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [changingBanner, setChangingBanner] = useState(false);
  const [updatingInviteVisibility, setUpdatingInviteVisibility] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    instructions: string;
    dueAt: string;
    maxPoints: number;
    allowedFileTypes: string;
    maxFileSizeMb: number | "";
    groupEnabled: boolean;
    groupMinMembers: number | "";
    groupMaxMembers: number | "";
    groupMode: "student" | "random";
  }>({
    title: "",
    instructions: "",
    dueAt: "",
    maxPoints: 100,
    allowedFileTypes: "",
    maxFileSizeMb: "",
    groupEnabled: false,
    groupMinMembers: "",
    groupMaxMembers: "",
    groupMode: "student",
  });
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [aiSource, setAiSource] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [flash, setFlash] = useState("");
  const [activeTab, setActiveTab] = useState("news");
  const [activeMeeting, setActiveMeeting] = useState<any | null>(null);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingHistory, setMeetingHistory] = useState<any[]>([]);
  const [meetingSupported, setMeetingSupported] = useState(true);
  const [mySubmissions, setMySubmissions] = useState<Record<string, any>>({});

  const normalizeMeeting = (payload: any) => {
    if (!payload) return null;
    return {
      ...payload,
      id: payload.id ?? payload.Id,
      roomCode: payload.roomCode ?? payload.RoomCode,
      title: payload.title ?? payload.Title,
      status: payload.status ?? payload.Status,
      startedAt: payload.startedAt ?? payload.StartedAt,
    };
  };

  async function copyInvite() {
    const code = classroom?.inviteCode || classroom?.InviteCode;
    const visible = classroom ? classroom.inviteCodeVisible ?? classroom.InviteCodeVisible ?? true : true;
    if (!visible) {
      toast.error("Mã mời đang bị ẩn");
      return;
    }
    if (!code) return;
    try { await navigator.clipboard.writeText(String(code)); toast.success("Đã sao chép mã mời"); }
    catch {
      const t = document.createElement('textarea'); t.value = String(code); document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); toast.success('Đã sao chép mã mời');
    }
  }

  async function generateQuizFromAI() {
    if (!aiSource.trim()) return;
    try {
      setAiGenerating(true);
      setAiResults([]);
      const { data } = await api.post("/ai/generate-quiz", {
        content: aiSource,
        count: aiCount,
        language: "vi",
      });
      const items = data?.items || data?.Items || [];
      setAiResults(items);
      if (items.length === 0) toast.error("Không sinh được câu hỏi.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Sinh câu hỏi thất bại";
      toast.error(msg);
    } finally {
      setAiGenerating(false);
    }
  }

  const escapeHtml = (input: string) => {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const toHtmlText = (input: string) => {
    return escapeHtml(input).replace(/\r?\n/g, "<br/>");
  };

  const stripOptionPrefix = (input: string) => {
    return input.replace(/^\s*[A-Da-d][\).\:-]\s*/, "").trim();
  };

  const splitInlineOptions = (input: string) => {
    const parts = input.split(/(?=\b[A-Da-d][\).\:-]\s)/g).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { question: input.trim(), options: [] as string[] };
    const question = parts[0].replace(/[:\-–]\s*$/, "").trim();
    const options = parts.slice(1).map(stripOptionPrefix).filter(Boolean);
    return { question, options };
  };

  function insertQuizToInstructions() {
    if (!aiResults || aiResults.length === 0) return;
    const html = aiResults
      .map((q: any, idx: number) => {
        const rawQuestion = String(q.question || q.Question || "").trim();
        const rawOptions = q.options ?? q.Options ?? [];
        let options = Array.isArray(rawOptions)
          ? rawOptions.map((o: any) => String(o ?? "").trim()).filter(Boolean)
          : typeof rawOptions === "string"
          ? rawOptions.split(/\r?\n/).map((o: string) => o.trim()).filter(Boolean)
          : [];
        let questionText = rawQuestion;
        if (rawQuestion) {
          const parsed = splitInlineOptions(rawQuestion);
          if (parsed.options.length >= 2) {
            questionText = parsed.question || rawQuestion;
            if (options.length === 0) {
              options = parsed.options;
            }
          }
        }
        const hasPrefix = options.length > 0 && options.every((o) => /^[A-Da-d][\).\:-]\s+/.test(o));
        const optionItems = options
          .map((o) => {
            const text = hasPrefix ? stripOptionPrefix(o) : o;
            return `<li>${toHtmlText(text)}</li>`;
          })
          .join("");
        const listHtml = optionItems
          ? `<ol style="list-style: upper-alpha; padding-left: 1.25rem; margin: 0.25rem 0;">${optionItems}</ol>`
          : "";
        const questionHtml = toHtmlText(questionText || rawQuestion || "");
        return `<div style="margin-bottom: 0.75rem;"><div><strong>Câu ${idx + 1}:</strong> ${questionHtml}</div>${listHtml}</div>`;
      })
      .join("<hr />");
    setForm((prev) => ({
      ...prev,
      instructions: (prev.instructions || "") + (prev.instructions ? "<br/>" : "") + html,
    }));
    toast.success("Đã chèn câu hỏi vào hướng dẫn.");
  }

  async function handleStartMeeting(title?: string) {
    if (!classroomId) return;
    setMeetingBusy(true);
    try {
      const payload: any = {};
      if (title && title.trim()) payload.title = title.trim();
      const { data } = await api.post(`/meetings/classrooms/${classroomId}`, payload);
      const meeting = normalizeMeeting(data);
      setActiveMeeting(meeting);
      toast.success("Đã tạo cuộc họp");
      router.push(`/meetings/${meeting?.roomCode}`);
    } catch (err: any) {
      const msg = err?.response?.data || "Không thể tạo cuộc họp";
      toast.error(typeof msg === "string" ? msg : "Không thể tạo cuộc họp");
    } finally {
      setMeetingBusy(false);
    }
  }

  async function handleJoinMeeting(roomCode?: string) {
    if (!roomCode) return;
    setMeetingBusy(true);
    try {
      await api.post("/meetings/join", { roomCode });
      router.push(`/meetings/${roomCode}`);
    } catch (err: any) {
      const msg = err?.response?.data || "Không thể tham gia phòng";
      toast.error(typeof msg === "string" ? msg : "Không thể tham gia phòng");
      await refreshMeetingState();
    } finally {
      setMeetingBusy(false);
    }
  }

  async function handleEndMeeting() {
    const meetingId = activeMeeting?.id ?? activeMeeting?.Id;
    if (!meetingId) return;
    setMeetingBusy(true);
    try {
      await api.post(`/meetings/${meetingId}/end`);
      toast.success("Đã kết thúc cuộc họp");
      setActiveMeeting(null);
      await refreshMeetingState();
    } catch (err: any) {
      const msg = err?.response?.data || "Không thể kết thúc cuộc họp";
      toast.error(typeof msg === "string" ? msg : "Không thể kết thúc cuộc họp");
    } finally {
      setMeetingBusy(false);
    }
  }

  async function handleChangeBanner() {
    setChangingBanner(true);
    try {
      await api.post(`/classrooms/${classroomId}/change-banner`);
      await refresh();
      toast.success("Đã đổi banner");
    } catch (err: any) {
      toast.error(err?.response?.data || "Đổi banner thất bại");
    } finally {
      setChangingBanner(false);
    }
  }

  async function handleInviteVisibility(visible: boolean) {
    setUpdatingInviteVisibility(true);
    try {
      await api.post(`/classrooms/${classroomId}/invite-code-visibility`, { visible });
      await refresh();
      toast.success(visible ? "Mã mời sẽ hiển thị" : "Mã mời đã bị ẩn");
    } catch (err: any) {
      toast.error(err?.response?.data || "Cập nhật cài đặt mã mời thất bại");
    } finally {
      setUpdatingInviteVisibility(false);
    }
  }

  function openAnnouncement() {
    setAnnounceDraft(null);
    setShowAnnounce(true);
  }

  function closeAnnouncement() {
    setShowAnnounce(false);
    setAnnounceDraft(null);
  }

  function handleReuseAnnouncement(draft: { sourceId: string; content: string; materials?: any[]; copyAttachments?: boolean }) {
    setAnnounceDraft(draft);
    setShowAnnounce(true);
  }


  // Edit state
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    instructions: string;
    dueAt: string;
    maxPoints: number;
    allowedFileTypes: string;
    maxFileSizeMb: number | "";
    groupEnabled: boolean;
    groupMinMembers: number | "";
    groupMaxMembers: number | "";
    groupMode: "student" | "random";
  }>({
    title: "",
    instructions: "",
    dueAt: "",
    maxPoints: 100,
    allowedFileTypes: "",
    maxFileSizeMb: "",
    groupEnabled: false,
    groupMinMembers: "",
    groupMaxMembers: "",
    groupMode: "student",
  });
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [editLinkInput, setEditLinkInput] = useState("");

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};

  const fetchActiveMeeting = useCallback(async () => {
    if (!classroomId || !meetingSupported) return;
    try {
      const { data } = await api.get(`/meetings/classrooms/${classroomId}/active`);
      setActiveMeeting(normalizeMeeting(data));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setActiveMeeting(null);
        setMeetingSupported(false);
      }
    }
  }, [classroomId, meetingSupported]);

  const fetchMeetingHistory = useCallback(async () => {
    if (!classroomId || !meetingSupported) return;
    try {
      const { data } = await api.get(`/meetings/classrooms/${classroomId}/history`);
      if (Array.isArray(data)) {
        setMeetingHistory(data.map((item: any) => normalizeMeeting(item)));
      } else {
        setMeetingHistory([]);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setMeetingSupported(false);
      }
      setMeetingHistory([]);
    }
  }, [classroomId, meetingSupported]);

  const refreshMeetingState = useCallback(async () => {
    if (!meetingSupported) return;
    await Promise.all([fetchActiveMeeting(), fetchMeetingHistory()]);
  }, [fetchActiveMeeting, fetchMeetingHistory, meetingSupported]);

  async function refresh() {
    try {
      const me = await api.get("/auth/me").catch(() => null);
      const myId = (me?.data?.id || "").toString().toLowerCase();
      const { data } = await api.get(`/classrooms/${classroomId}`);
      const normalized = {
        ...data,
        inviteCodeVisible: data.inviteCodeVisible ?? data.InviteCodeVisible ?? true,
      };
      setClassroom(normalized);
      try {
        const subs = await api.get("/submissions/my");
        if (Array.isArray(subs?.data)) {
          const map: Record<string, any> = {};
          subs.data.forEach((s: any) => {
            const aid = (s.assignmentId ?? s.AssignmentId ?? "").toString().toLowerCase();
            if (aid) map[aid] = s;
          });
          setMySubmissions(map);
        }
      } catch {
        setMySubmissions({});
      }

      const members = (normalized.Members || normalized.members || []) as any[];
      const teacherByRole = members.some(
        (m: any) => (m.Role || m.role) === "Teacher" && ((m.UserId || m.userId || "").toString().toLowerCase() === myId)
      );
      const teacherByName = members.some(
        (m: any) =>
          (m.Role || m.role) === "Teacher" &&
          (m.FullName || m.fullName || "").toString().trim().toLowerCase() ===
            (user.fullName || "").toString().trim().toLowerCase()
      );
      const teacherByOwner = !!(normalized.TeacherId && myId && (normalized.TeacherId as string).toLowerCase() === myId);
      setIsTeacher(teacherByRole || teacherByName || teacherByOwner);
      await refreshMeetingState();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (!classroomId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [classroomId]);

  // Auto refresh members/assignments periodically and on focus
  useEffect(() => {
    if (!classroomId) return;
    const onFocus = () => refresh();
    const timer = meetingSupported ? setInterval(() => refresh(), 5000) : null;
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [classroomId, meetingSupported]);

  useClassroomRealtime(classroomId, {
    onMemberJoined: (p: any) => {
      setClassroom((prev: any) => {
        if (!prev) return prev;
        const list = [...(((prev.Members ?? prev.members) as any[]) || [])];
        const uid = String(p?.userId || "").toLowerCase();
        if (!uid) return prev;
        const exists = list.some((m: any) => String(m.UserId || m.userId).toLowerCase() === uid);
        if (exists) return prev;
        const added = { UserId: p.userId, FullName: p.fullName || "", Role: "Student", Avatar: p.avatar };
        const members = [...list, added];
        return { ...prev, Members: members, members };
      });
    },
    onAnnouncementAdded: (_a: any) => {
      // Announcements panel manages its own list; no action needed here
    },
    onAssignmentCreated: (a: any) => {
      setClassroom((prev: any) => {
        if (!prev) return prev;
        const cur = [ ...(((prev.assignments ?? prev.Assignments) as any[]) || []) ];
        const idLc = String(a?.Id || a?.id || "").toLowerCase();
        const without = cur.filter((x: any) => String(x.Id || x.id).toLowerCase() !== idLc);
        const normalized = {
          Id: a.Id ?? a.id,
          Title: a.Title ?? a.title,
          DueAt: a.DueAt ?? a.dueAt ?? null,
          MaxPoints: a.MaxPoints ?? a.maxPoints,
          AllowedFileTypes: a.AllowedFileTypes ?? a.allowedFileTypes ?? "",
          MaxFileSizeBytes: a.MaxFileSizeBytes ?? a.maxFileSizeBytes ?? null,
          GroupEnabled: a.GroupEnabled ?? a.groupEnabled ?? false,
          GroupMinMembers: a.GroupMinMembers ?? a.groupMinMembers ?? null,
          GroupMaxMembers: a.GroupMaxMembers ?? a.groupMaxMembers ?? null,
          GroupMode: a.GroupMode ?? a.groupMode ?? "student",
          CreatedAt: a.CreatedAt ?? a.createdAt,
          ClassroomId: a.ClassroomId ?? a.classroomId
        };
        const next = [ normalized, ...without ];
        return { ...prev, Assignments: next, assignments: next };
      });
    },
    onAssignmentUpdated: (a: any) => {
      setClassroom((prev: any) => {
        if (!prev) return prev;
        const cur = [ ...(((prev.assignments ?? prev.Assignments) as any[]) || []) ];
        const idLc = String(a?.Id || a?.id || "").toLowerCase();
        const next = cur.map((x: any) => {
          const xid = String(x.Id || x.id).toLowerCase();
          if (xid !== idLc) return x;
          return {
            ...x,
            Title: a.Title ?? a.title ?? x.Title ?? x.title,
            DueAt: (a.DueAt ?? a.dueAt ?? x.DueAt ?? x.dueAt) ?? null,
            MaxPoints: a.MaxPoints ?? a.maxPoints ?? x.MaxPoints ?? x.maxPoints,
            AllowedFileTypes: a.AllowedFileTypes ?? a.allowedFileTypes ?? x.AllowedFileTypes ?? x.allowedFileTypes ?? "",
            MaxFileSizeBytes: a.MaxFileSizeBytes ?? a.maxFileSizeBytes ?? x.MaxFileSizeBytes ?? x.maxFileSizeBytes ?? null,
            GroupEnabled: a.GroupEnabled ?? a.groupEnabled ?? x.GroupEnabled ?? x.groupEnabled ?? false,
            GroupMinMembers: a.GroupMinMembers ?? a.groupMinMembers ?? x.GroupMinMembers ?? x.groupMinMembers ?? null,
            GroupMaxMembers: a.GroupMaxMembers ?? a.groupMaxMembers ?? x.GroupMaxMembers ?? x.groupMaxMembers ?? null,
            GroupMode: a.GroupMode ?? a.groupMode ?? x.GroupMode ?? x.groupMode ?? "student"
          };
        });
        return { ...prev, Assignments: next, assignments: next };
      });
    },
    onAssignmentDeleted: (payload: any) => {
      setClassroom((prev: any) => {
        if (!prev) return prev;
        const cur = [ ...(((prev.assignments ?? prev.Assignments) as any[]) || []) ];
        const delId = String(payload?.id || payload?.Id || "").toLowerCase();
        const next = cur.filter((x: any) => String(x.Id || x.id).toLowerCase() !== delId);
        return { ...prev, Assignments: next, assignments: next };
      });
    },
  });

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [
      { id: "news", label: "Bảng tin" },
      { id: "assignments", label: "Bài tập trên lớp" },
      { id: "meetings", label: "Cuộc họp" },
      { id: "members", label: "Mọi người" },
    ];
    if (isTeacher) {
      items.push({ id: "grades", label: "Điểm", indicator: true });
    }
    return items;
  }, [isTeacher]);

  useEffect(() => {
    if (tabs.length) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    try {
      setCreating(true);
      const hasUploads = attachFiles.length > 0 || links.length > 0;
      if (hasUploads) {
        const fd = new FormData();
        fd.append("ClassroomId", String(classroomId));
        fd.append("Title", form.title.trim());
        if (form.instructions) fd.append("Instructions", form.instructions);
        if (form.dueAt) fd.append("DueAt", new Date(form.dueAt).toISOString());
        fd.append("MaxPoints", String(Number(form.maxPoints) || 100));
        if (form.allowedFileTypes.trim()) fd.append("AllowedFileTypes", form.allowedFileTypes.trim());
        const maxSizeMb = Number(form.maxFileSizeMb);
        if (!Number.isNaN(maxSizeMb) && maxSizeMb > 0) fd.append("MaxFileSizeMb", String(maxSizeMb));
        fd.append("GroupEnabled", String(!!form.groupEnabled));
        if (form.groupEnabled) {
          fd.append("GroupMode", form.groupMode === "random" ? "random" : "student");
          const minMembers = Number(form.groupMinMembers);
          const maxMembers = Number(form.groupMaxMembers);
          if (!Number.isNaN(minMembers) && minMembers > 0) fd.append("GroupMinMembers", String(minMembers));
          if (!Number.isNaN(maxMembers) && maxMembers > 0) fd.append("GroupMaxMembers", String(maxMembers));
        }
        attachFiles.forEach((f) => fd.append("Files", f));
        if (links.length) fd.append("Links", JSON.stringify(links));
        await api.post("/assignments/with-materials", fd);
      } else {
        const maxSizeMb = Number(form.maxFileSizeMb);
        const minMembers = Number(form.groupMinMembers);
        const maxMembers = Number(form.groupMaxMembers);
        await api.post("/assignments", {
          ClassroomId: String(classroomId),
          Title: form.title.trim(),
          Instructions: form.instructions || undefined,
          DueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          MaxPoints: Number(form.maxPoints) || 100,
          AllowedFileTypes: form.allowedFileTypes.trim() || undefined,
          MaxFileSizeMb: !Number.isNaN(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : null,
          GroupEnabled: !!form.groupEnabled,
          GroupMinMembers: form.groupEnabled && !Number.isNaN(minMembers) && minMembers > 0 ? minMembers : null,
          GroupMaxMembers: form.groupEnabled && !Number.isNaN(maxMembers) && maxMembers > 0 ? maxMembers : null,
          GroupMode: form.groupEnabled ? (form.groupMode === "random" ? "random" : "student") : null,
        });
      }

      setShowCreate(false);
      toast.success("Đã tạo bài tập");
      setFlash(`Đã giao bài: ${form.title.trim()}`);
      setTimeout(() => setFlash(""), 4000);
      setForm({
        title: "",
        instructions: "",
        dueAt: "",
        maxPoints: 100,
        allowedFileTypes: "",
        maxFileSizeMb: "",
        groupEnabled: false,
        groupMinMembers: "",
        groupMaxMembers: "",
        groupMode: "student",
      });
      setAttachFiles([]);
      setLinks([]);
      setLinkInput("");
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Tạo bài tập thất bại");
    } finally { setCreating(false); }
  }

  function startEdit(a: any) {
    const allowedFileTypes = a.allowedFileTypes ?? a.AllowedFileTypes ?? "";
    const maxBytes = a.maxFileSizeBytes ?? a.MaxFileSizeBytes;
    const maxFileSizeMb = maxBytes ? Math.round(Number(maxBytes) / (1024 * 1024)) : "";
    const groupEnabled = !!(a.groupEnabled ?? a.GroupEnabled);
    const groupMinMembers = a.groupMinMembers ?? a.GroupMinMembers ?? "";
    const groupMaxMembers = a.groupMaxMembers ?? a.GroupMaxMembers ?? "";
    const groupModeRaw = (a.groupMode ?? a.GroupMode ?? "student").toString().toLowerCase();
    const groupMode = groupModeRaw === "random" ? "random" : "student";
    setEditing(a);
    setEditForm({
      title: a.title || "",
      instructions: a.instructions || "",
      dueAt: a.dueAt ? new Date(a.dueAt).toISOString().slice(0, 16) : "",
      maxPoints: a.maxPoints || 100,
      allowedFileTypes,
      maxFileSizeMb,
      groupEnabled,
      groupMinMembers,
      groupMaxMembers,
      groupMode,
    });
    const mats = a.attachments || a.materials || a.files || [];
    const detectedLinks = (mats || [])
      .map((m: any) => m.url || m.link)
      .filter(Boolean);
    setEditLinks(detectedLinks);
    setEditFiles([]);
    setEditLinkInput("");
  }

  async function updateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const id = editing.id;
    try {
      const maxSizeMb = Number(editForm.maxFileSizeMb);
      const minMembers = Number(editForm.groupMinMembers);
      const maxMembers = Number(editForm.groupMaxMembers);
      const payload = {
        title: editForm.title.trim(),
        instructions: editForm.instructions || undefined,
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : null,
        maxPoints: Number(editForm.maxPoints) || 100,
        allowedFileTypes: editForm.allowedFileTypes.trim() || undefined,
        maxFileSizeMb: !Number.isNaN(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : null,
        groupEnabled: !!editForm.groupEnabled,
        groupMinMembers: editForm.groupEnabled && !Number.isNaN(minMembers) && minMembers > 0 ? minMembers : null,
        groupMaxMembers: editForm.groupEnabled && !Number.isNaN(maxMembers) && maxMembers > 0 ? maxMembers : null,
        groupMode: editForm.groupEnabled ? (editForm.groupMode === "random" ? "random" : "student") : null,
      };
      await api.put(`/assignments/${id}`, payload);

      if (editFiles.length > 0 || editLinks.length > 0) {
        const fd = new FormData();
        editFiles.forEach((f) => fd.append("files", f));
        if (editLinks.length) fd.append("links", JSON.stringify(editLinks));
        try {
          await api.post(`/assignments/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        } catch {
          await api.post(`/assignments/${id}/materials`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        }
      }

      toast.success("Đã cập nhật bài tập");
      setEditing(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Cập nhật thất bại");
    }
  }

  async function removeAssignment(aid: string) {
    if (!confirm("Bạn có chắc muốn xóa bài tập này?")) return;
    try {
      await api.delete(`/assignments/${aid}`);
      toast.success("Đã xóa bài tập");
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xóa thất bại");
    }
  }


  if (loading)
    return (
      <div className="p-6 space-y-4">
        <Card className="p-6 space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </Card>
        <Card className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
    );

  if (!classroom)
    return (
      <div className="p-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Không tìm thấy lớp học.</div>
      </div>
    );

  const bannerList = [
    "/images/banners/banner-1.svg",
    "/images/banners/banner-2.svg",
    "/images/banners/banner-3.svg",
    "/images/banners/banner-4.svg",
  ];
  const bannerFromServer = (classroom.bannerUrl || classroom.BannerUrl) as string | undefined;
  const bannerSeed = String(classroom.inviteCode || classroom.InviteCode || classroom.id || classroom.Id || classroom.name || "0");
  let sum = 0;
  for (let i = 0; i < bannerSeed.length; i++) sum = (sum + bannerSeed.charCodeAt(i)) % 1024;
  const computedBanner = bannerList[sum % bannerList.length];
  const bannerUrl = bannerFromServer || computedBanner;
  const inviteVisible = classroom.inviteCodeVisible ?? classroom.InviteCodeVisible ?? true;
  const membersList = ((classroom?.Members ?? classroom?.members) as any[]) || [];
  const gradeMembers = membersList.filter((m: any) => (m.role ?? m.Role) !== "Teacher");
  return (
    <div className="p-4 md:p-6 space-y-6">
      {flash && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-2 text-sm">
          {flash}
        </div>
      )}
        <ClassroomHero
          classroom={classroom}
          bannerUrl={bannerUrl}
          inviteVisible={inviteVisible}
          isTeacher={isTeacher}
          onCopyInvite={copyInvite}
          onToggleSettings={() => setShowSettings((prev) => !prev)}
        />
      <ClassroomSettingsSheet
        open={showSettings}
        inviteVisible={inviteVisible}
        changingBanner={changingBanner}
        updatingInviteVisibility={updatingInviteVisibility}
        onClose={() => setShowSettings(false)}
        onChangeBanner={handleChangeBanner}
        onToggleInvite={() => handleInviteVisibility(!inviteVisible)}
      />
      <div className="space-y-4">
        <ClassroomTabMenu tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "news" && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-4">
            <AnnouncementsPanel
              classroomId={String(classroomId)}
              isTeacher={isTeacher}
              onReuse={handleReuseAnnouncement}
              onCreate={openAnnouncement}
            />
          </div>
        )}
        {activeTab === "assignments" && (
          <AssignmentsCard
            assignments={classroom.assignments || []}
            submissions={mySubmissions}
            isTeacher={isTeacher}
            onCreate={() => setShowCreate(true)}
            onEdit={startEdit}
            onDelete={removeAssignment}
          />
        )}
        {activeTab === "members" && <MembersCard members={membersList} />}
        {activeTab === "grades" && (
          <div className="max-w-full overflow-x-auto min-w-0">
            <GradesTable
              assignments={classroom.assignments || []}
              members={gradeMembers}
            />
          </div>
        )}
        {activeTab === "meetings" && (
          <MeetingPanel
            meeting={activeMeeting}
            history={meetingHistory}
            classroomName={classroom?.name ?? classroom?.Name}
            isTeacher={isTeacher}
            meetingBusy={meetingBusy}
            onStart={handleStartMeeting}
            onJoin={handleJoinMeeting}
            onEnd={handleEndMeeting}
          />
        )}
      </div>
      <AssignmentCreateModal
        open={showCreate}
        creating={creating}
        form={form}
        setForm={setForm}
        attachFiles={attachFiles}
        setAttachFiles={setAttachFiles}
        links={links}
        setLinks={setLinks}
        linkInput={linkInput}
        setLinkInput={setLinkInput}
        aiSource={aiSource}
        setAiSource={setAiSource}
        aiCount={aiCount}
        setAiCount={setAiCount}
        aiGenerating={aiGenerating}
        aiResults={aiResults}
        onGenerateQuiz={generateQuizFromAI}
        onInsertQuiz={insertQuizToInstructions}
        onSubmit={createAssignment}
        onClose={() => setShowCreate(false)}
      />
      <AssignmentEditModal
        editing={editing}
        form={editForm}
        setForm={setEditForm}
        files={editFiles}
        setFiles={setEditFiles}
        links={editLinks}
        setLinks={setEditLinks}
        linkInput={editLinkInput}
        setLinkInput={setEditLinkInput}
        onSubmit={updateAssignment}
        onClose={() => setEditing(null)}
      />
      {showAnnounce && (
        <AnnouncementModal
          classroomId={String(classroomId)}
          draft={announceDraft}
          onClose={closeAnnouncement}
        />
      )}
    </div>
  );
}
