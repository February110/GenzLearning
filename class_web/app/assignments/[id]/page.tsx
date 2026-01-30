"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import {
  MessageSquare,
  CheckCircle2,
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import api from "@/api/client";
import { resolveAvatar } from "@/utils/resolveAvatar";
import { getSignalR } from "@/lib/signalr";
import CommentsPanel from "@/components/assignments/CommentsPanel";
import { toast } from "react-hot-toast";
import { openFileViewer, isLikelyFileUrl } from "@/utils/fileViewer";

export default function AssignmentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<{ name: string; size: number; progress: number; status: "uploading"|"done"|"error" }[]>([]);
  const [subs, setSubs] = useState<any[]>([]); // all submissions (teacher view)
  const [mySubs, setMySubs] = useState<any[]>([]); // my submissions (student view)
  const [uploading, setUploading] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [students, setStudents] = useState<any[]>([]); // classroom students
  const [filter, setFilter] = useState<'all'|'submitted'|'assigned'>('all');
  const [rosterQuery, setRosterQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [gradeInput, setGradeInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroup, setMyGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [nextLeaderId, setNextLeaderId] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const dueTs = useMemo(() => {
    const d = (assignment as any)?.dueAt || (assignment as any)?.DueAt;
    return d ? new Date(d).getTime() : null;
  }, [assignment]);
  const groupEnabled = useMemo(() => {
    return !!(assignment?.groupEnabled ?? assignment?.GroupEnabled);
  }, [assignment]);
  const groupMode = useMemo(() => {
    const raw = assignment?.groupMode ?? assignment?.GroupMode;
    return String(raw || "").toLowerCase() === "random" ? "random" : "student";
  }, [assignment]);
  const allowedTokens = useMemo<string[]>(() => {
    const raw = String(assignment?.allowedFileTypes || assignment?.AllowedFileTypes || "");
    return raw
      .split(/[,;\s]+/)
      .map((token) => token.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean);
  }, [assignment]);
  const maxFileSizeBytes = useMemo(() => {
    const val = assignment?.maxFileSizeBytes ?? assignment?.MaxFileSizeBytes ?? null;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [assignment]);
  const allowedTypesLabel = useMemo(() => {
    if (!allowedTokens.length) return "";
    return allowedTokens.map((t) => (t.includes("/") ? t : `.${t}`)).join(", ");
  }, [allowedTokens]);
  const acceptAttr = useMemo(() => {
    if (!allowedTokens.length) return undefined;
    return allowedTokens.map((t) => (t.includes("/") ? t : `.${t}`)).join(",");
  }, [allowedTokens]);

  function formatFileSize(bytes: number) {
    const mb = 1024 * 1024;
    if (!bytes || bytes <= 0) return "0 MB";
    if (bytes % mb === 0) return `${bytes / mb} MB`;
    return `${(bytes / mb).toFixed(1)} MB`;
  }

  function getInitials(name: string) {
    try {
      return (name || "??")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((s) => s[0])
        .join("")
        .toUpperCase();
    } catch {
      return "??";
    }
  }

  function getAvatar(member: any) {
    const raw =
      member?.avatar ||
      member?.Avatar ||
      member?.photoUrl ||
      member?.PhotoUrl ||
      member?.image ||
      member?.picture;
    if (!raw) return undefined;
    return resolveAvatar(raw) || raw;
  }

  function getOriginalNameFromKey(key?: string) {
    if (!key) return "";
    const lastSlash = key.lastIndexOf("/");
    const basename = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
    const timePrefix = /^\d{8}-\d{6}-/;
    if (timePrefix.test(basename)) return basename.replace(timePrefix, "");
    const parts = basename.split("_");
    return parts.length > 1 ? parts.slice(1).join("_") : basename;
  }

  function getFileExtension(name?: string) {
    if (!name) return "";
    const clean = name.split("?")[0];
    const parts = clean.split(".");
    if (parts.length < 2) return "";
    return parts.pop()!.toLowerCase();
  }

  function getFileTypeKey(name?: string, contentType?: string) {
    const type = (contentType || "").toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    if (type.includes("pdf")) return "pdf";
    if (type.includes("wordprocessing") || type.includes("msword")) return "doc";
    if (type.includes("spreadsheet") || type.includes("excel")) return "xls";
    if (type.includes("presentation") || type.includes("powerpoint")) return "ppt";
    if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return "archive";
    const ext = getFileExtension(name);
    return ext;
  }

  function getFileIcon(name?: string, contentType?: string) {
    const key = getFileTypeKey(name, contentType);
    if (key === "image" || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(key)) return FileImage;
    if (key === "video" || ["mp4", "mov", "avi", "mkv", "webm"].includes(key)) return FileVideo;
    if (key === "audio" || ["mp3", "wav", "ogg", "m4a"].includes(key)) return FileAudio;
    if (key === "archive" || ["zip", "rar", "7z", "tar", "gz"].includes(key)) return FileArchive;
    if (key === "xls" || ["xls", "xlsx", "csv", "ods"].includes(key)) return FileSpreadsheet;
    if (["js", "ts", "tsx", "jsx", "py", "java", "cs", "cpp", "c", "html", "css", "json", "xml", "yaml", "yml", "sql"].includes(key)) {
      return FileCode;
    }
    if (key === "doc" || ["doc", "docx", "ppt", "pptx", "pdf", "txt", "rtf", "odt", "odp"].includes(key)) {
      return FileText;
    }
    return FileIcon;
  }

  function getFileIconClass(name?: string, contentType?: string) {
    const key = getFileTypeKey(name, contentType);
    if (key === "image" || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(key)) {
      return "text-emerald-600 dark:text-emerald-300";
    }
    if (key === "video" || ["mp4", "mov", "avi", "mkv", "webm"].includes(key)) {
      return "text-rose-600 dark:text-rose-300";
    }
    if (key === "audio" || ["mp3", "wav", "ogg", "m4a"].includes(key)) {
      return "text-amber-600 dark:text-amber-300";
    }
    if (key === "doc" || ["doc", "docx", "rtf", "odt"].includes(key)) {
      return "text-blue-600 dark:text-blue-300";
    }
    if (key === "xls" || ["xls", "xlsx", "csv", "ods"].includes(key)) {
      return "text-emerald-700 dark:text-emerald-300";
    }
    if (key === "ppt" || ["ppt", "pptx", "odp"].includes(key)) {
      return "text-orange-600 dark:text-orange-300";
    }
    if (key === "pdf") return "text-red-600 dark:text-red-300";
    if (key === "archive" || ["zip", "rar", "7z", "tar", "gz"].includes(key)) {
      return "text-violet-600 dark:text-violet-300";
    }
    return "text-indigo-600 dark:text-indigo-300";
  }

  function getFileLabel(name?: string, contentType?: string) {
    const key = getFileTypeKey(name, contentType);
    if (!key) return "FILE";
    if (key === "image") return "IMG";
    if (key === "video") return "VIDEO";
    if (key === "audio") return "AUDIO";
    if (key === "doc") return "DOC";
    if (key === "xls") return "XLS";
    if (key === "ppt") return "PPT";
    if (key === "pdf") return "PDF";
    if (key === "archive") return "ZIP";
    if (key.length <= 6) return key.toUpperCase();
    return "FILE";
  }

  function isFileTypeAllowed(file: File) {
    if (!allowedTokens.length) return true;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const contentType = (file.type || "").toLowerCase();
    return allowedTokens.some((token) => {
      if (!token) return false;
      if (token.includes("/")) {
        if (token.endsWith("/*")) {
          const prefix = token.slice(0, -1);
          return contentType.startsWith(prefix);
        }
        return contentType === token;
      }
      return ext === token;
    });
  }

  function validateFile(file: File) {
    if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
      return `Dung lượng tối đa mỗi tệp là ${formatFileSize(maxFileSizeBytes)}.`;
    }
    if (!isFileTypeAllowed(file)) {
      return `Định dạng không hợp lệ. Cho phép: ${allowedTypesLabel}.`;
    }
    return null;
  }

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const myGroupData = useMemo(() => (myGroup?.group ?? myGroup?.Group) || null, [myGroup]);
  const myMemberInfo = useMemo(() => (myGroup?.member ?? myGroup?.Member) || null, [myGroup]);
  const myGroupMembers = useMemo(() => {
    const raw = myGroupData?.members ?? myGroupData?.Members ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [myGroupData]);
  const myGroupId = useMemo(() => {
    const raw = myGroupData?.id ?? myGroupData?.Id ?? "";
    return raw ? String(raw) : "";
  }, [myGroupData]);
  const myIsLeader = !!(myMemberInfo && String(myMemberInfo.role || myMemberInfo.Role || "") === "Leader");
  const myCanSubmit = myIsLeader;
  const groupMinMembers = assignment?.groupMinMembers ?? assignment?.GroupMinMembers ?? null;
  const groupMaxMembers = assignment?.groupMaxMembers ?? assignment?.GroupMaxMembers ?? null;
  const groupMemberCount = myGroupMembers.length;
  const groupMeetsMin = !groupMinMembers || groupMemberCount >= groupMinMembers;
  const canSubmitNow = !groupEnabled || (!!myGroupData && myCanSubmit && groupMeetsMin);
  const groupLocked = useMemo(() => {
    return !!(dueTs && Date.now() > dueTs);
  }, [dueTs]);
  const myGroupHasSubmission = useMemo(() => {
    if (!myGroupId) return false;
    return (mySubs || []).some((s: any) => String(s.groupId ?? s.GroupId ?? "") === myGroupId);
  }, [mySubs, myGroupId]);
  const canEditGroup = useMemo(() => {
    return groupMode === "student" && !groupLocked && !myGroupHasSubmission;
  }, [groupMode, groupLocked, myGroupHasSubmission]);
  const currentGroupName = useMemo(() => {
    return (myGroupData?.name ?? myGroupData?.Name ?? "").toString();
  }, [myGroupData]);
  const groupNameChanged = useMemo(() => {
    const trimmed = editGroupName.trim();
    return trimmed.length > 0 && trimmed !== currentGroupName.trim();
  }, [editGroupName, currentGroupName]);

  useEffect(() => {
    const name = (myGroupData?.name ?? myGroupData?.Name ?? "").toString();
    setEditGroupName(name);
    setNextLeaderId("");
  }, [myGroupId]);

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try { const { data } = await api.get(`/comments/assignment/${id}`); setComments(data || []); } catch {}
    })();
  }, [id]);
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    const hubBase = base.replace(/\/api$/, "");
    const conn = getSignalR(hubBase, "/hubs/notifications");
    const handler = (payload: any) => {
      const aid = payload?.assignmentId ?? payload?.AssignmentId;
      if (!aid || String(aid).toLowerCase() !== String(id).toLowerCase()) return;
      const grade = payload?.grade ?? payload?.Grade ?? payload?.score ?? payload?.Score ?? null;
      const gradeStatus = payload?.gradeStatus ?? payload?.GradeStatus ?? payload?.status ?? payload?.Status ?? null;
      const feedback = payload?.feedback ?? payload?.Feedback ?? null;
      const updatedAt = payload?.updatedAt ?? payload?.UpdatedAt ?? null;
      const returnedFileKey = payload?.returnedFileKey ?? payload?.ReturnedFileKey ?? null;
      const returnedFileName = payload?.returnedFileName ?? payload?.ReturnedFileName ?? null;
      const returnedFileSize = payload?.returnedFileSize ?? payload?.ReturnedFileSize ?? null;
      const returnedAt = payload?.returnedAt ?? payload?.ReturnedAt ?? null;
      const submissionId = payload?.submissionId ?? payload?.SubmissionId ?? null;
      setMySubs((prev) =>
        prev.map((s: any) => {
          const sid = s.id ?? s.Id;
          const existingDetail = (s.gradeDetail || s.GradeDetail || {}) as any;
          return {
            ...s,
            grade: grade ?? s.grade,
            gradeStatus: gradeStatus ?? s.gradeStatus,
            feedback: feedback ?? s.feedback,
            gradeUpdatedAt: updatedAt ?? s.gradeUpdatedAt,
            gradeDetail: {
              ...existingDetail,
              score: grade ?? existingDetail.score ?? existingDetail.Score ?? s.grade ?? s.Grade ?? null,
              feedback: feedback ?? existingDetail.feedback ?? existingDetail.Feedback ?? s.feedback ?? s.Feedback ?? null,
              status: gradeStatus ?? existingDetail.status ?? existingDetail.Status ?? s.gradeStatus ?? s.GradeStatus ?? null,
              submissionId: submissionId ?? existingDetail.submissionId ?? existingDetail.SubmissionId ?? sid,
              updatedAt: updatedAt ?? existingDetail.updatedAt ?? existingDetail.UpdatedAt ?? s.gradeUpdatedAt ?? s.GradeUpdatedAt ?? null,
              returnedFileKey: returnedFileKey ?? existingDetail.returnedFileKey ?? existingDetail.ReturnedFileKey ?? null,
              returnedFileName: returnedFileName ?? existingDetail.returnedFileName ?? existingDetail.ReturnedFileName ?? null,
              returnedFileSize: returnedFileSize ?? existingDetail.returnedFileSize ?? existingDetail.ReturnedFileSize ?? null,
              returnedAt: returnedAt ?? existingDetail.returnedAt ?? existingDetail.ReturnedAt ?? null,
            },
          };
        })
      );
    };
    try { (conn as any).off?.("GradeUpdated", handler as any); } catch {}
    conn.on("GradeUpdated", handler);
    const ensure = async () => {
      try { await conn.start().catch(() => {}); } catch {}
    };
    ensure();
    (conn as any).onreconnected?.(() => ensure());
    return () => {
      try { (conn as any).off?.("GradeUpdated", handler as any); } catch {}
    };
  }, [id]);

  async function load() {
    try {
      const { data } = await api.get(`/assignments/${id}`);
      setAssignment(data);
      const enableGroups = !!(data?.groupEnabled ?? data?.GroupEnabled);
      try {
        const mats = await api.get(`/assignments/${id}/materials`);
        setAssignment((prev:any)=> ({ ...(prev||{}), materials: mats.data }));
      } catch {}
      await Promise.all([
        detectRole(data?.classroomId || data?.ClassroomId),
        loadSubs(),
        loadMySubs(),
        enableGroups ? loadGroups(true) : Promise.resolve(),
        enableGroups ? loadMyGroup(true) : Promise.resolve(),
      ]);
    } catch (e:any) {
      const msg = e?.response?.data?.message || e?.message || 'Không tải được bài tập';
      toast.error(msg);
    }
    finally { setLoading(false); }
  }

  async function loadSubs(){
    try { const { data } = await api.get(`/submissions/by-assignment/${id}`); setSubs(data); } catch {}
  }

  async function loadMySubs(){
    try {
      const { data } = await api.get(`/submissions/my`);
      const items = (data || [])
        .filter((x:any)=> (x.assignmentId||x.AssignmentId) === id)
        .sort((a:any,b:any)=> new Date(b.submittedAt||b.SubmittedAt).getTime() - new Date(a.submittedAt||a.SubmittedAt).getTime());
      setMySubs(items);
    } catch {}
  }

  async function loadGroups(forceEnabled?: boolean) {
    const enabled = typeof forceEnabled === "boolean" ? forceEnabled : groupEnabled;
    if (!enabled) {
      setGroups([]);
      return;
    }
    try {
      const { data } = await api.get(`/assignments/${id}/groups`);
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    }
  }

  async function loadMyGroup(forceEnabled?: boolean) {
    const enabled = typeof forceEnabled === "boolean" ? forceEnabled : groupEnabled;
    if (!enabled) {
      setMyGroup(null);
      return;
    }
    try {
      const { data } = await api.get(`/assignments/${id}/groups/me`);
      setMyGroup(data || null);
    } catch (err: any) {
      if (err?.response?.status === 404) setMyGroup(null);
    }
  }

  async function createGroup() {
    if (!groupName.trim()) {
      toast.error("Vui lòng nhập tên nhóm");
      return;
    }
    try {
      setGroupBusy(true);
      await api.post(`/assignments/${id}/groups`, {
        name: groupName.trim(),
      });
      toast.success("Đã tạo nhóm");
      setGroupName("");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Tạo nhóm thất bại");
    } finally {
      setGroupBusy(false);
    }
  }

  async function joinGroup(groupId: string) {
    try {
      setGroupBusy(true);
      await api.post(`/assignments/${id}/groups/${groupId}/join`);
      toast.success("Đã tham gia nhóm");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Tham gia nhóm thất bại");
    } finally {
      setGroupBusy(false);
    }
  }

  async function leaveGroup(groupId: string) {
    try {
      setGroupBusy(true);
      await api.post(`/assignments/${id}/groups/${groupId}/leave`);
      toast.success("Đã rời nhóm");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Rời nhóm thất bại");
    } finally {
      setGroupBusy(false);
    }
  }

  async function updateGroupName(groupId: string) {
    if (!editGroupName.trim()) {
      toast.error("Vui lòng nhập tên nhóm");
      return;
    }
    try {
      setGroupBusy(true);
      await api.patch(`/assignments/${id}/groups/${groupId}`, {
        name: editGroupName.trim(),
      });
      toast.success("Đã cập nhật nhóm");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Cập nhật nhóm thất bại");
    } finally {
      setGroupBusy(false);
    }
  }

  async function transferLeader(groupId: string) {
    if (!nextLeaderId) {
      toast.error("Vui lòng chọn trưởng nhóm mới");
      return;
    }
    try {
      setGroupBusy(true);
      await api.patch(`/assignments/${id}/groups/${groupId}`, {
        leaderId: nextLeaderId,
      });
      toast.success("Đã chuyển trưởng nhóm");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Chuyển trưởng nhóm thất bại");
    } finally {
      setGroupBusy(false);
    }
  }

  async function removeMember(groupId: string, userId: string) {
    try {
      setGroupBusy(true);
      await api.delete(`/assignments/${id}/groups/${groupId}/members/${userId}`);
      toast.success("Đã xóa thành viên");
      await Promise.all([loadGroups(true), loadMyGroup(true)]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xóa thành viên thất bại");
    } finally {
      setGroupBusy(false);
    }
  }


  async function handleDeleteSubmission(subId?: string){
    try{
      if (groupEnabled && !myCanSubmit) {
        toast.error("Bạn không có quyền hủy bài nộp của nhóm.");
        return;
      }
      if(subId){
        await api.delete(`/submissions/${subId}`);
      } else {
        await api.delete(`/submissions/by-assignment/${id}`);
      }
      toast.success("Đã hủy bài nộp. Bạn có thể nộp lại.");
      await loadMySubs();
    }catch(err:any){
      const msg = err?.response?.data?.message || "Hủy bài nộp thất bại";
      toast.error(msg);
    }
  }

  async function detectRole(classroomId?: string){
    try{
      if(!classroomId) return;
      const { data } = await api.get(`/classrooms/${classroomId}`);
      const meRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const me = meRaw ? JSON.parse(meRaw) : null;
      const myName = (me?.fullName||'').toString().trim().toLowerCase();
      const members = (data.Members || data.members || []) as any[];
      const teacher = members.find(m => (m.Role||m.role) === 'Teacher');
      setIsTeacher(!!teacher && ((teacher.FullName||teacher.fullName||'').toString().trim().toLowerCase() === myName));
      // pick students list
      const studs = members.filter(m => (m.Role||m.role) === 'Student').map(m => ({
        name: m.FullName || m.fullName || '',
        email: m.Email || m.email || '',
        userId: m.UserId || m.userId || '',
        avatar: m.Avatar || m.avatar || '',
      }));
      setStudents(studs);
    }catch{}
  }

  async function submitFile(e: React.FormEvent){
    e.preventDefault();
    if (groupEnabled) {
      if (!myGroupData) {
        toast.error("Bạn chưa có nhóm cho bài tập này.");
        return;
      }
      if (!myCanSubmit) {
        toast.error("Bạn không có quyền nộp bài cho nhóm.");
        return;
      }
      if (!groupMeetsMin) {
        toast.error("Nhóm chưa đủ số lượng thành viên theo yêu cầu.");
        return;
      }
    }
    if(!files || files.length === 0){ toast.error('Chọn tệp trước'); return; }
    await uploadSelected(files);
  }

  async function uploadSelected(selected: File[]){
    try {
      const invalid = selected
        .map((f) => ({ file: f, error: validateFile(f) }))
        .filter((x) => x.error);
      if (invalid.length > 0) {
        invalid.forEach((x) => toast.error(`${x.file.name}: ${x.error}`));
        return;
      }
      setUploading(true);
      setUploadList(selected.map(f => ({ name: f.name, size: f.size, progress: 0, status: "uploading" })));

      // Upload từng file để có progress riêng (ổn định hơn multi-endpoint)
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];
        const fd = new FormData();
        fd.append('file', f);
        try {
          await api.post(`/submissions/${id}/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt: any) => {
              const total = evt.total || f.size || 1;
              const p = Math.min(99, Math.round((evt.loaded / total) * 100));
              setUploadList(prev => prev.map((it, idx) => idx === i ? { ...it, progress: p } : it));
            },
          });
          setUploadList(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 100, status: "done" } : it));
        } catch (err) {
          setUploadList(prev => prev.map((it, idx) => idx === i ? { ...it, status: "error" } : it));
          throw err;
        }
      }

      toast.success('Đã nộp bài');
      setFiles([]);
      await Promise.all([loadSubs(), loadMySubs()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Nộp bài thất bại');
    } finally {
      setUploading(false);
    }
  }

  async function grade(subId:string){
    const grade = Number(prompt('Điểm:'));
    const feedback = prompt('Nhận xét:') ?? undefined;
    if(isNaN(grade)) return;
    try{ await api.put(`/grades/${subId}`, { grade, feedback, status: "graded" }); toast.success('Chấm điểm thành công'); loadSubs(); }
    catch(err:any){ toast.error(err?.response?.data?.message || 'Chấm điểm thất bại'); }
  }

  function openByKey(key: string, name?: string) {
    openFileViewer({ key, name });
  }

  function downloadGradesFile() {
    if (!students.length) {
      toast.error("Chưa có danh sách học viên");
      return;
    }
    const titleRaw = assignment?.title || assignment?.Title || `assignment-${id}`;
    const safeTitle = String(titleRaw).replace(/[\\/:*?"<>|]/g, "_").trim() || `assignment-${id}`;
    const rowsHtml = students
      .map((s: any) => {
        const g = byUserId.get((s.userId || "").toString());
        const submitted = !!g;
        const isLate = !!(submitted && dueTs && g?.latestAt > dueTs);
        const score = submitted ? (g.grade ?? "") : 0;
        const status = submitted ? (isLate ? "Nộp muộn" : "Đã nộp") : "Chưa nộp";
        return `
          <tr>
            <td>${String(s.name || "").replace(/</g, "&lt;")}</td>
            <td>${String(s.email || "").replace(/</g, "&lt;")}</td>
            <td style="text-align:center;">${score === "" ? "" : String(score)}</td>
            <td>${status}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th style="background-color:#00B0F0;color:#000;font-weight:bold;">Họ và tên</th>
                <th style="background-color:#00B0F0;color:#000;font-weight:bold;">Email</th>
                <th style="background-color:#00B0F0;color:#000;font-weight:bold;">Điểm</th>
                <th style="background-color:#00B0F0;color:#000;font-weight:bold;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-diem.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Removed assignment-level CommentAdded listener. CommentsPanel handles thread-level realtime.

  // Group submissions by student so multiple files show as one row (Google Classroom style)
  const grouped = useMemo(() => {
    if (groupEnabled) return [];
    const map = new Map<string, any>();
    subs.forEach((s: any) => {
      const userId = (s.userId || s.UserId || "").toString();
      const email = (s.email || s.Email || "").toLowerCase();
      const name = s.studentName || s.StudentName || email || "";
      const size = s.fileSize ?? s.FileSize ?? 0;
      const fileKey = s.fileKey ?? s.FileKey ?? "";
      const contentType = s.contentType ?? s.ContentType ?? "";
      const at = new Date(s.submittedAt || s.SubmittedAt).getTime();
      const id = s.id || s.Id;
      const key = userId || email || name;
      const gradeDetail = (s.gradeDetail || s.GradeDetail || null) as any;
      const gradeStatus = (s.gradeStatus ?? s.GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status) || null;
      const gradeScore = (s.grade ?? s.Grade ?? gradeDetail?.score ?? gradeDetail?.Score) ?? null;
      const feedback = s.feedback ?? s.Feedback ?? gradeDetail?.feedback ?? gradeDetail?.Feedback ?? null;
      const returnedFileKey = gradeDetail?.returnedFileKey ?? gradeDetail?.ReturnedFileKey ?? null;
      const returnedFileName = gradeDetail?.returnedFileName ?? gradeDetail?.ReturnedFileName ?? null;
      if (!map.has(key)) {
        map.set(key, {
          userId,
          email,
          studentName: name,
          totalSize: size,
          latestAt: at,
          grade: gradeScore,
          gradeStatus,
          feedback,
          returnedFileKey,
          returnedFileName,
          files: [{ id, size, at, fileKey, contentType, grade: gradeScore, gradeStatus, feedback }],
        });
      } else {
        const g = map.get(key);
        g.totalSize += size;
        if (at > g.latestAt) {
          g.latestAt = at;
          g.grade = gradeScore ?? g.grade;
          g.gradeStatus = gradeStatus ?? g.gradeStatus;
          g.feedback = feedback ?? g.feedback;
        } else if (gradeScore != null && g.grade == null) {
          g.grade = gradeScore;
        }
        if (gradeStatus && !g.gradeStatus) g.gradeStatus = gradeStatus;
        if (returnedFileKey && !g.returnedFileKey) g.returnedFileKey = returnedFileKey;
        if (returnedFileName && !g.returnedFileName) g.returnedFileName = returnedFileName;
        g.files.push({ id, size, at, fileKey, contentType, grade: gradeScore, gradeStatus, feedback });
      }
    });
    const arr = Array.from(map.values());
    arr.forEach((g: any) => g.files.sort((a: any, b: any) => b.at - a.at));
    return arr.sort((a: any, b: any) => b.latestAt - a.latestAt);
  }, [subs, groupEnabled]);

  const groupSubmissions = useMemo(() => {
    const map = new Map<string, any>();
    if (!groupEnabled) return map;
    subs.forEach((s: any) => {
      const groupId = (s.groupId || s.GroupId || "").toString();
      if (!groupId) return;
      const groupName = s.groupName || s.GroupName || "";
      const size = s.fileSize ?? s.FileSize ?? 0;
      const fileKey = s.fileKey ?? s.FileKey ?? "";
      const contentType = s.contentType ?? s.ContentType ?? "";
      const at = new Date(s.submittedAt || s.SubmittedAt).getTime();
      const id = s.id || s.Id;
      const submitterId = (s.userId || s.UserId || "").toString();
      const submitterName = s.studentName || s.StudentName || s.submittedByName || s.SubmittedByName || "";
      const gradeDetail = (s.gradeDetail || s.GradeDetail || null) as any;
      const gradeStatus = (s.gradeStatus ?? s.GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status) || null;
      const gradeScore = (s.grade ?? s.Grade ?? gradeDetail?.score ?? gradeDetail?.Score) ?? null;
      const feedback = s.feedback ?? s.Feedback ?? gradeDetail?.feedback ?? gradeDetail?.Feedback ?? null;
      const returnedFileKey = gradeDetail?.returnedFileKey ?? gradeDetail?.ReturnedFileKey ?? null;
      const returnedFileName = gradeDetail?.returnedFileName ?? gradeDetail?.ReturnedFileName ?? null;
      if (!map.has(groupId)) {
        map.set(groupId, {
          groupId,
          groupName,
          totalSize: size,
          latestAt: at,
          grade: gradeScore,
          gradeStatus,
          feedback,
          returnedFileKey,
          returnedFileName,
          submittedById: submitterId,
          submittedByName: submitterName,
          files: [{ id, size, at, fileKey, contentType, grade: gradeScore, gradeStatus, feedback }],
        });
      } else {
        const g = map.get(groupId);
        g.totalSize += size;
        if (at > g.latestAt) {
          g.latestAt = at;
          g.grade = gradeScore ?? g.grade;
          g.gradeStatus = gradeStatus ?? g.gradeStatus;
          g.feedback = feedback ?? g.feedback;
          g.submittedById = submitterId || g.submittedById;
          g.submittedByName = submitterName || g.submittedByName;
        } else if (gradeScore != null && g.grade == null) {
          g.grade = gradeScore;
        }
        if (gradeStatus && !g.gradeStatus) g.gradeStatus = gradeStatus;
        if (returnedFileKey && !g.returnedFileKey) g.returnedFileKey = returnedFileKey;
        if (returnedFileName && !g.returnedFileName) g.returnedFileName = returnedFileName;
        g.files.push({ id, size, at, fileKey, contentType, grade: gradeScore, gradeStatus, feedback });
      }
    });
    map.forEach((g: any) => g.files.sort((a: any, b: any) => b.at - a.at));
    return map;
  }, [subs, groupEnabled]);

  const normalizedGroups = useMemo(() => {
    if (!groupEnabled) return [];
    return (groups || []).map((g: any) => {
      const id = (g.id ?? g.Id ?? "").toString();
      const membersRaw = g.members ?? g.Members ?? [];
      const members = (membersRaw || []).map((m: any) => ({
        userId: (m.userId ?? m.UserId ?? "").toString(),
        name: m.fullName ?? m.FullName ?? "",
        email: m.email ?? m.Email ?? "",
        avatar: m.avatar ?? m.Avatar ?? "",
        role: m.role ?? m.Role ?? "Member",
        canSubmit: m.canSubmit ?? m.CanSubmit ?? false,
      }));
      const leaderId = (g.leaderId ?? g.LeaderId ?? "").toString();
      const leaderName = g.leaderName ?? g.LeaderName ?? members.find((m: any) => m.userId === leaderId)?.name;
      const submission = id ? groupSubmissions.get(id) : null;
      return {
        id,
        name: g.name ?? g.Name ?? "Nhóm",
        leaderId,
        leaderName,
        members,
        submission,
      };
    });
  }, [groups, groupSubmissions, groupEnabled]);

  // Map by user id for quick lookup
  const byEmail = useMemo(() => {
    const m = new Map<string, any>();
    grouped.forEach((g) => { if (g.userId) m.set(g.userId, g); });
    return m;
  }, [grouped]);

  const byUserId = useMemo(() => {
    if (!groupEnabled) return byEmail;
    const m = new Map<string, any>();
    normalizedGroups.forEach((g: any) => {
      g.members.forEach((mbr: any) => {
        m.set(mbr.userId, g.submission || null);
      });
    });
    return m;
  }, [groupEnabled, normalizedGroups, byEmail]);

  const stats = useMemo(() => {
    if (groupEnabled) {
      const total = normalizedGroups.length;
      let submitted = 0, graded = 0, late = 0;
      normalizedGroups.forEach(g => {
        const sub = g.submission;
        if (sub) {
          submitted++;
          if (sub.grade != null) graded++;
          if (dueTs && sub.latestAt > dueTs) late++;
        }
      });
      return { total, submitted, notSubmitted: total - submitted, graded, late };
    }
    const total = students.length;
    let submitted = 0, graded = 0, late = 0;
    students.forEach(s => {
      const g = byEmail.get((s.userId||'').toString());
      if (g) { 
        submitted++; 
        if (g.grade != null) graded++; 
        if (dueTs && g.latestAt > dueTs) late++;
      }
    });
    return { total, submitted, notSubmitted: total - submitted, graded, late };
  }, [students, byEmail, dueTs, groupEnabled, normalizedGroups]);

  const roster = useMemo(()=>{
    if (groupEnabled) {
      return normalizedGroups
        .map((g:any)=> ({ ...g, group: g.submission, submitted: !!g.submission, latestAt: g.submission?.latestAt || 0 }))
        .filter(item => filter==='all' ? true : filter==='submitted' ? item.submitted : !item.submitted)
        .filter(item => {
          const key = rosterQuery.trim().toLowerCase();
          if (!key) return true;
          const nameMatch = (item.name || "").toLowerCase().includes(key);
          const memberMatch = item.members?.some((m: any) =>
            (m.name || "").toLowerCase().includes(key) || (m.email || "").toLowerCase().includes(key)
          );
          return nameMatch || memberMatch;
        })
        .sort((a,b)=> b.latestAt - a.latestAt || (a.name || "").localeCompare(b.name || ""));
    }
    return students
      .map((s:any)=>{
        const g = byEmail.get((s.userId||'').toString());
        return { ...s, group:g, submitted: !!g, latestAt: g?.latestAt || 0 };
      })
      .filter(item => filter==='all' ? true : filter==='submitted' ? item.submitted : !item.submitted)
      .filter(item => {
        const key = rosterQuery.trim().toLowerCase();
        if (!key) return true;
        return item.name.toLowerCase().includes(key) || item.email.toLowerCase().includes(key);
      })
      .sort((a,b)=> b.latestAt - a.latestAt || a.name.localeCompare(b.name));
  }, [students, byEmail, filter, rosterQuery, groupEnabled, normalizedGroups]);

  const selectedGroup = useMemo(()=> byEmail.get(selectedEmail), [byEmail, selectedEmail]);
  const selectedGroupEntry = useMemo(() => {
    if (!groupEnabled) return null;
    return normalizedGroups.find((g: any) => g.id === String(selectedGroupId)) || null;
  }, [groupEnabled, normalizedGroups, selectedGroupId]);
  const selectedStudent = useMemo(() => {
    return students.find((s) => (s.userId || "").toString() === selectedEmail) || null;
  }, [students, selectedEmail]);
  const selectedAvatar = selectedStudent ? getAvatar(selectedStudent) : undefined;
  const selectedSubmission = groupEnabled ? selectedGroupEntry?.submission : selectedGroup;
  const selectedCommentUserId = groupEnabled
    ? (selectedGroupEntry?.leaderId || selectedGroupEntry?.members?.[0]?.userId || undefined)
    : (selectedEmail || undefined);
  const detailIsLate = !!(dueTs && selectedSubmission?.latestAt && selectedSubmission.latestAt > dueTs);
  const detailSubmitLabel = selectedSubmission ? (detailIsLate ? "Nộp muộn" : "Đã nộp") : "Chưa nộp";
  const detailSubmitClass = selectedSubmission
    ? detailIsLate
      ? "bg-rose-50 text-rose-600 border-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300"
      : "bg-emerald-50 text-emerald-700 border-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
    : "bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-800 dark:bg-zinc-800 dark:text-gray-200";
  const detailGradeLabel = selectedSubmission
    ? selectedSubmission.gradeStatus === "returned"
      ? `Điểm: ${selectedSubmission.grade ?? "-"}`
      : selectedSubmission.grade != null
      ? `Điểm: ${selectedSubmission.grade}`
      : selectedSubmission.gradeStatus === "pending"
      ? "Đang chấm"
      : "Chưa chấm"
    : "Chưa chấm";
  const detailGradeClass =
    selectedSubmission?.gradeStatus === "returned"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
      : selectedSubmission?.grade != null
      ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300"
      : selectedSubmission?.gradeStatus === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-100 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
      : "bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-800 dark:bg-zinc-800 dark:text-gray-200";

  useEffect(()=>{
    // Auto select first in roster for teacher view
    if(!isTeacher || !roster.length) return;
    if (groupEnabled) {
      if (!selectedGroupId) setSelectedGroupId((roster[0].id || "").toString());
      return;
    }
    if(!selectedEmail){
      setSelectedEmail((roster[0].userId||'').toString());
    }
  }, [isTeacher, roster, selectedEmail, selectedGroupId, groupEnabled]);

  if (loading) return <div className="p-6"><div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Đang tải...</div></div>;
  if (!assignment) return <div className="p-6"><div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Không tìm thấy bài tập</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{assignment.title}</h1>
        <div className="prose prose-sm max-w-none dark:prose-invert mt-2 text-gray-800 dark:text-gray-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: assignment.instructions || 'Không có hướng dẫn' }} />
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Hạn: {assignment.dueAt || assignment.DueAt ? new Date(assignment.dueAt || assignment.DueAt).toLocaleString() : 'Không có'}</div>

        {/* Tài liệu đính kèm */}
        {(() => {
          const materials = assignment.materials || assignment.attachments || assignment.files || [];
          if (!materials || materials.length === 0) return null;
          return (
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">Tài liệu đính kèm</div>
              <ul className="space-y-2">
                {materials.map((m: any, idx: number) => {
                  const url =
                    m.url ||
                    m.link ||
                    (m.path ? resolveAvatar(m.path) : m.filePath ? resolveAvatar(m.filePath) : undefined);
                  const key = m.key || m.fileKey;
                  const name = m.name || m.fileName || m.originalName || url || key || "Tài liệu";
                  const isLinkKey = typeof key === "string" && key.startsWith("link-");
                  const canUseKey = Boolean(key) && !isLinkKey;
                  const canPreviewUrl = Boolean(url) && isLikelyFileUrl(url, name);
                  return (
                    <li key={idx} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                      <div className="truncate text-sm">{name}</div>
                      {canUseKey ? (
                        <button className="text-indigo-600 text-sm hover:underline" onClick={() => openByKey(key, name)}>
                          Xem
                        </button>
                      ) : url ? (
                        canPreviewUrl ? (
                          <button
                            className="text-indigo-600 text-sm hover:underline"
                            onClick={() => openFileViewer({ url, name })}
                          >
                            Xem
                          </button>
                        ) : (
                          <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm hover:underline">
                            Mở liên kết
                          </a>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
      </div>

      {/* Submit section (students) */}
      {!isTeacher && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">
          <div className="text-lg font-semibold mb-3">Bài tập của bạn</div>
          {groupEnabled && (
            <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Nhóm của bạn</div>
                {(groupMinMembers || groupMaxMembers) && (
                  <div className="text-xs text-gray-500">
                    Yêu cầu: tối thiểu {groupMinMembers || 1}
                    {groupMaxMembers ? ` • tối đa ${groupMaxMembers}` : ""}
                  </div>
                )}
              </div>
              {!myGroupData ? (
                groupMode === "random" ? (
                  <div className="text-sm text-gray-600">
                    Giáo viên sẽ chia nhóm ngẫu nhiên cho bài tập này. Vui lòng chờ thông báo.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">Bạn chưa có nhóm cho bài tập này.</div>
                    {groupLocked && (
                      <div className="text-xs text-rose-600">Đã quá thời điểm chốt nhóm.</div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] items-center">
                      <input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Tên nhóm"
                        disabled={groupBusy || groupLocked}
                        className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm disabled:opacity-60"
                      />
                      <button
                        type="button"
                        disabled={groupBusy || groupLocked || !groupName.trim()}
                        onClick={createGroup}
                        className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
                      >
                        Tạo nhóm
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">Nhóm hiện có</div>
                      {groups.length === 0 ? (
                        <div className="text-xs text-gray-500">Chưa có nhóm nào.</div>
                      ) : (
                        <div className="space-y-2">
                          {groups.map((g: any) => {
                            const gid = String(g.id ?? g.Id ?? "");
                            const members = g.members ?? g.Members ?? [];
                            const count = Array.isArray(members) ? members.length : 0;
                            const max = groupMaxMembers;
                            const min = groupMinMembers;
                            const isFull = !!(max && count >= max);
                            const statusLabel = max
                              ? isFull
                                ? "Đã đủ"
                                : "Chưa đủ"
                              : min
                              ? count >= min
                                ? "Đã đủ"
                                : "Chưa đủ"
                              : "";
                            const statusClass = isFull ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
                            const leaderName = g.leaderName ?? g.LeaderName;
                            return (
                              <div
                                key={gid || count}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {g.name ?? g.Name ?? "Nhóm"}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {leaderName ? `Trưởng nhóm: ${leaderName}` : `${count} thành viên`}
                                    {max ? ` • ${count}/${max}` : ""}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {statusLabel && (
                                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${statusClass}`}>
                                      {statusLabel}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={groupBusy || groupLocked || !gid || isFull}
                                    onClick={() => joinGroup(gid)}
                                    className="rounded-full border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                                  >
                                    Tham gia
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {myGroupData.name || myGroupData.Name || "Nhóm"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Thành viên: {groupMemberCount}
                        {groupMaxMembers ? `/${groupMaxMembers}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(groupMinMembers || groupMaxMembers) && (
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ${
                            groupMaxMembers && groupMemberCount >= groupMaxMembers
                              ? "bg-emerald-50 text-emerald-700"
                              : groupMinMembers && groupMemberCount >= groupMinMembers
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {groupMaxMembers
                            ? groupMemberCount >= groupMaxMembers
                              ? "Đã đủ"
                              : "Chưa đủ"
                            : groupMinMembers
                            ? groupMemberCount >= groupMinMembers
                              ? "Đã đủ"
                              : "Chưa đủ"
                            : ""}
                        </span>
                      )}
                      <span className={`text-xs rounded-full px-2 py-1 ${myCanSubmit ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {myCanSubmit ? "Trưởng nhóm nộp bài" : "Thành viên"}
                      </span>
                    </div>
                  </div>
                  {!groupMeetsMin && (
                    <div className="text-xs text-rose-600">Nhóm chưa đủ số lượng thành viên theo yêu cầu.</div>
                  )}
                  {groupLocked && (
                    <div className="text-xs text-rose-600">Đã quá thời điểm chốt nhóm.</div>
                  )}
                  <div className="space-y-2">
                    {myGroupMembers.map((m: any) => {
                      const role = (m.role || m.Role || "").toLowerCase();
                      const isLeader = role === "leader";
                      return (
                        <div key={m.userId || m.UserId} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {m.fullName || m.FullName || m.name || m.email || "Thành viên"}
                            </div>
                            <div className="text-gray-500 truncate">
                              {isLeader ? "Trưởng nhóm" : "Thành viên"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {myIsLeader && !isLeader && canEditGroup && (
                              <button
                                type="button"
                                className="text-rose-600 hover:underline disabled:opacity-60"
                                disabled={groupBusy}
                                onClick={() =>
                                  removeMember(
                                    myGroupData.id || myGroupData.Id,
                                    (m.userId || m.UserId || "").toString()
                                  )
                                }
                              >
                                Xóa
                              </button>
                            )}
                            {isLeader && <span className="text-[10px] text-indigo-600">Leader</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {myIsLeader && groupMode === "student" && (
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <div className="text-xs text-gray-500">Đổi tên nhóm</div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            disabled={!canEditGroup || groupBusy}
                            placeholder="Tên nhóm"
                            className="w-full sm:w-auto flex-1 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={!canEditGroup || groupBusy || !groupNameChanged}
                            onClick={() => updateGroupName((myGroupData.id || myGroupData.Id) as string)}
                            className="rounded-full border border-indigo-200 text-indigo-700 px-4 py-2 text-xs hover:bg-indigo-50 disabled:opacity-60"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                      {myGroupMembers.length > 1 && (
                        <div className="grid gap-2">
                          <div className="text-xs text-gray-500">Chuyển trưởng nhóm</div>
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={nextLeaderId}
                              disabled={!canEditGroup || groupBusy}
                              onChange={(e) => setNextLeaderId(e.target.value)}
                              className="w-full sm:w-auto flex-1 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs disabled:opacity-60"
                            >
                              <option value="">Chọn thành viên</option>
                              {myGroupMembers
                                .filter((m: any) => String(m.userId || m.UserId || "") !== String(myGroupData?.leaderId || myGroupData?.LeaderId || ""))
                                .map((m: any) => (
                                  <option key={m.userId || m.UserId} value={m.userId || m.UserId}>
                                    {m.fullName || m.FullName || m.name || m.email}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              disabled={!canEditGroup || groupBusy || !nextLeaderId}
                              onClick={() => transferLeader((myGroupData.id || myGroupData.Id) as string)}
                              className="rounded-full border border-indigo-200 text-indigo-700 px-4 py-2 text-xs hover:bg-indigo-50 disabled:opacity-60"
                            >
                              Chuyển
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {groupMode === "student" && (
                    <div className="flex flex-wrap gap-2">
                      {!myIsLeader && (
                        <button
                          type="button"
                          disabled={!canEditGroup || groupBusy}
                          onClick={() => leaveGroup((myGroupData.id || myGroupData.Id) as string)}
                          className="rounded-full border px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Rời nhóm
                        </button>
                      )}
                      {myIsLeader && (
                        <button
                          type="button"
                          disabled={!canEditGroup || groupBusy || groupMemberCount > 1}
                          onClick={() => leaveGroup((myGroupData.id || myGroupData.Id) as string)}
                          className="rounded-full border px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                        >
                          {groupMemberCount > 1 ? "Chuyển trưởng nhóm để rời" : "Giải tán nhóm"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <form onSubmit={submitFile} className="flex flex-col gap-4">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <label className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${canSubmitNow ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800" : "opacity-60 cursor-not-allowed"}`}>
                <input
                  multiple
                  type="file"
                  accept={acceptAttr}
                  className="hidden"
                  disabled={!canSubmitNow}
                  onChange={(e)=> {
                    const list = Array.from(e.target.files || []);
                    if (list.length === 0) return;
                    const valid: File[] = [];
                    const errors: string[] = [];
                    list.forEach((f) => {
                      const err = validateFile(f);
                      if (err) errors.push(`${f.name}: ${err}`);
                      else valid.push(f);
                    });
                    errors.forEach((msg) => toast.error(msg));
                    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
                    (e.target as HTMLInputElement).value = "";
                  }}
                />
                + Thêm tệp
              </label>
              <button type="submit" disabled={uploading || files.length === 0 || !canSubmitNow} className="rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm">
                {uploading ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
            {groupEnabled && !canSubmitNow && (
              <div className="text-xs text-rose-600">Chỉ trưởng nhóm mới có thể nộp bài.</div>
            )}
            {(allowedTokens.length > 0 || maxFileSizeBytes) && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {allowedTokens.length > 0 && <span>Định dạng: {allowedTypesLabel}</span>}
                {maxFileSizeBytes && <span>{allowedTokens.length > 0 ? " • " : ""}Tối đa: {formatFileSize(maxFileSizeBytes)}</span>}
              </div>
            )}

            {/* Selected files (before upload) */}
            {files.length > 0 && uploadList.length === 0 && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs">
                    <span className="truncate">{f.name} <span className="text-gray-400">({(f.size/1024).toFixed(1)} KB)</span></span>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>Xóa</button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress */}
            {uploadList.length > 0 && (
              <div className="space-y-1">
                {uploadList.map((it, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs">
                    <span className="truncate">{it.name} <span className="text-gray-400">({(it.size/1024).toFixed(1)} KB)</span></span>
                    <div className="flex items-center gap-3">
                      <div className="w-40 h-1.5 bg-gray-200 rounded">
                        <div className={`h-1.5 rounded ${it.status==='error' ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${it.progress}%` }} />
                      </div>
                      <span className="w-10 text-right">{it.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
          {/* My submissions list */}
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {mySubs.length === 0 ? (
              <div>Chưa có bài nộp.</div>
            ) : (
              <div className="space-y-2">
                {mySubs.map((s:any, i:number) => {
                  const key = s.fileKey || s.FileKey;
                  const ts = new Date(s.submittedAt || s.SubmittedAt).toLocaleString();
                  const size = s.fileSize || s.FileSize || 0;
                  const gradeDetail = (s.gradeDetail || s.GradeDetail || null) as any;
                  const grade = s.grade ?? s.Grade ?? gradeDetail?.score ?? gradeDetail?.Score ?? null;
                  const gradeStatus = s.gradeStatus ?? s.GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status ?? "";
                  const returnedFileKey = gradeDetail?.returnedFileKey ?? gradeDetail?.ReturnedFileKey ?? null;
                  const returnedFileName = gradeDetail?.returnedFileName ?? gradeDetail?.ReturnedFileName ?? null;
                  const submittedById = s.submittedById ?? s.SubmittedById ?? null;
                  const submittedByName = s.submittedByName ?? s.SubmittedByName ?? "";
                  const groupName = s.groupName ?? s.GroupName ?? "";
                  const isMineSubmit = !groupEnabled || !submittedById || String(submittedById) === String(user?.id ?? user?.userId ?? user?.Id ?? "");
                  const isReturned = gradeStatus === "returned";
                  const isGraded = gradeStatus === "graded" || gradeStatus === "returned";
                  const isPastDue = !!(dueTs && Date.now() > dueTs);
                  const canCancel = !isGraded && !isPastDue && (!groupEnabled || myCanSubmit);
                  const cancelTitle = isGraded
                    ? "Bài đã được chấm nên không thể hủy."
                    : isPastDue
                    ? "Đã quá hạn nộp bài nên không thể hủy."
                    : groupEnabled && !myCanSubmit
                    ? "Bạn không có quyền hủy bài nộp của nhóm."
                    : "Hủy nộp";
                  const gradeLabel =
                    isReturned && grade != null
                      ? `Điểm: ${grade}`
                      : gradeStatus === "graded"
                      ? "Đã chấm (chưa trả)"
                      : gradeStatus === "pending"
                      ? "Đang chấm"
                      : "Chưa chấm";
                  const original = getOriginalNameFromKey(key) || "Tệp";
                  const Icon = getFileIcon(original);
                  const iconClass = getFileIconClass(original);
                  const label = getFileLabel(original);
                  return (
                    <div key={s.id || s.Id || i} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                      <div className="flex items-start gap-3 min-w-0 pr-3">
                        <div className={`h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 ${iconClass} flex items-center justify-center shrink-0`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white break-words">{original}</div>
                            <span className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                              {label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {ts} • {(size/1024).toFixed(1)} KB
                            {groupEnabled && groupName ? ` • ${groupName}` : ""}
                          </div>
                          {groupEnabled && submittedByName && !isMineSubmit && (
                            <div className="text-xs text-gray-500">Nộp bởi {submittedByName}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-1 rounded-md text-xs ${isReturned ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}`}>
                          {gradeLabel}
                        </span>
                        {isReturned && returnedFileKey && (
                          <button
                            className="shrink-0 rounded-full border px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() =>
                              openFileViewer({ key: returnedFileKey, name: returnedFileName || "Bài đã chấm" })
                            }
                          >
                            Bài đã chấm
                          </button>
                        )}
                        <button
                          className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => {
                            if (key) openFileViewer({ key, name: original || "Tệp" });
                          }}
                        >
                          Xem
                        </button>
                        <button
                          className={`shrink-0 rounded-md border border-red-200 text-red-600 px-3 py-1.5 text-xs dark:border-red-800 dark:text-red-300 ${canCancel ? "hover:bg-red-50 dark:hover:bg-red-900/30" : "opacity-50 cursor-not-allowed"}`}
                          disabled={!canCancel}
                          title={cancelTitle}
                          onClick={()=>handleDeleteSubmission(s.id || s.Id)}
                        >
                          Hủy nộp
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Trao đổi riêng giữa học viên và giáo viên (chỉ hiện cho học viên) */}
      {!isTeacher && <CommentsPanel assignmentId={id} />}

      {/* Teacher-only submissions table */}
      {isTeacher && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-0 overflow-hidden shadow-sm">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 dark:bg-zinc-900/60">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {groupEnabled ? "Bài tập của nhóm" : "Bài tập của học viên"}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                Đã nộp: {stats.submitted}
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-gray-700 dark:border-gray-800 dark:bg-zinc-800 dark:text-gray-200">
                Chưa nộp: {stats.notSubmitted}
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300">
                Đã chấm: {stats.graded}
              </span>
              {dueTs && (
                <span className="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-rose-600 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
                  Nộp muộn: {stats.late}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-gray-700 dark:border-gray-800 dark:bg-zinc-800 dark:text-gray-200">
                Tổng: {stats.total}
              </span>
              <button
                type="button"
                onClick={downloadGradesFile}
                disabled={!students.length}
                className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Xuất điểm
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Left roster */}
            <div className="border-r border-gray-100 dark:border-gray-800 p-5 space-y-3 bg-gray-50/40 dark:bg-zinc-900/40">
              <div className="space-y-2">
                <input
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  placeholder={groupEnabled ? "Tìm nhóm..." : "Tìm học viên..."}
                  className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{groupEnabled ? "Tất cả nhóm" : "Tất cả học viên"}</div>
                  <select value={filter} onChange={(e)=> setFilter(e.target.value as any)} className="text-xs border rounded-full px-3 py-1 bg-white dark:bg-zinc-900 focus:outline-none">
                    <option value="all">Tất cả</option>
                    <option value="submitted">Đã nộp</option>
                    <option value="assigned">Chưa nộp</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {roster.map((r:any, idx:number)=>{
                  const isGroupRow = groupEnabled;
                  const email = (r.email||'').toLowerCase();
                  const uid = (r.userId||'').toString();
                  const rowId = isGroupRow ? (r.id || "").toString() : uid;
                  const active = isGroupRow ? selectedGroupId === rowId : selectedEmail === uid;
                  const g = r.group;
                  const keyStable = rowId || r.userId || email || r.name || String(idx);
                  const isLate = !!(dueTs && g && g.latestAt > dueTs);
                  const avatarSrc = isGroupRow ? undefined : getAvatar(r);
                  const statusDotClass = g ? (isLate ? "bg-rose-500" : "bg-emerald-500") : "bg-gray-300";
                  const statusTitle = g ? (isLate ? "Nộp muộn" : "Đã nộp") : "Chưa nộp";
                  const memberCount = isGroupRow ? (r.members?.length || 0) : 0;
                  const leaderName = isGroupRow ? (r.leaderName || r.members?.find((m:any) => (m.role || "").toLowerCase() === "leader")?.name) : "";
                  return (
                    <button
                      key={keyStable}
                      onClick={() => {
                        if (isGroupRow) {
                          setSelectedGroupId(rowId);
                        } else {
                          setSelectedEmail(uid);
                        }
                        setGradeInput(g?.grade ?? "");
                        setFeedbackInput("");
                        setReturnFile(null);
                      }}
                      className={`w-full text-left rounded-lg border px-3 py-3 text-sm transition ${active ? 'border-indigo-500 bg-indigo-50/80 shadow-sm dark:bg-zinc-900' : 'border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-zinc-950 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm'}`}
                    >
                      <div className="flex items-start gap-3">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={r.name || "Học viên"}
                            className="h-9 w-9 rounded-full object-cover border border-white/30"
                          />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-semibold">
                            {getInitials(r.name || r.email || "N")}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {r.name || (isGroupRow ? "Nhóm" : "Học viên")}
                              </div>
                              {isGroupRow ? (
                                <div className="text-xs text-gray-500 truncate">
                                  {leaderName ? `Trưởng nhóm: ${leaderName}` : `${memberCount} thành viên`}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500 truncate">{r.email || "—"}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {g && isLate && (
                                <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 text-[11px]">
                                  Muộn
                                </span>
                              )}
                              <div className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} title={statusTitle} />
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            {g
                              ? `${g.files.length} tệp • ${(g.totalSize / 1024).toFixed(1)} KB • ${new Date(g.latestAt).toLocaleString()}`
                              : "Chưa nộp"}
                          </div>
                          {g && (
                            <div className="text-xs text-gray-500">
                              {g.gradeStatus === "returned"
                                ? `Đã trả • Điểm: ${g.grade ?? "-"}`
                                : g.grade != null
                                ? `Đã chấm • Điểm: ${g.grade}`
                                : g.gradeStatus === "pending"
                                ? "Đang chấm"
                                : "Chưa chấm"}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right detail */}
            <div className="lg:col-span-2 p-5">
              {(groupEnabled ? !selectedGroupEntry : !selectedEmail) ? (
                <div className="text-gray-500">
                  {groupEnabled ? "Chọn một nhóm để xem chi tiết." : "Chọn một học viên để xem chi tiết."}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {groupEnabled ? (
                          <>
                            <span className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                              {getInitials(selectedGroupEntry?.name || "N")}
                            </span>
                            <div className="min-w-0">
                              <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {selectedGroupEntry?.name || "Nhóm"}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {selectedGroupEntry?.leaderName
                                  ? `Trưởng nhóm: ${selectedGroupEntry.leaderName}`
                                  : `${selectedGroupEntry?.members?.length || 0} thành viên`}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {selectedAvatar ? (
                              <img
                                src={selectedAvatar}
                                alt={selectedStudent?.name || "Học viên"}
                                className="h-10 w-10 rounded-full object-cover border border-white/30"
                              />
                            ) : (
                              <span className="h-10 w-10 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-sm font-semibold">
                                {getInitials(selectedStudent?.name || selectedStudent?.email || "?")}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {selectedStudent?.name || "Học viên"}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{selectedStudent?.email || "-"}</div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 ${detailSubmitClass}`}>
                          {detailSubmitLabel}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 ${detailGradeClass}`}>
                          {detailGradeLabel}
                        </span>
                      </div>
                    </div>
                    {groupEnabled && selectedGroupEntry?.members?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                        {selectedGroupEntry.members.map((m: any) => {
                          const avatar = getAvatar(m);
                          const isLeader = String(m.role || "").toLowerCase() === "leader";
                          return (
                            <span
                              key={m.userId}
                              className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 px-2 py-1 w-fit max-w-[150px]"
                            >
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={m.name || m.email || "Member"}
                                  className="h-5 w-5 rounded-full object-cover border border-white/40"
                                />
                              ) : (
                                <span className="h-5 w-5 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-semibold">
                                  {getInitials(m.name || m.email || "?")}
                                </span>
                              )}
                              <span className="truncate max-w-[70px]">{m.name || m.email}</span>
                              {isLeader && (
                                <span className="text-[10px] text-indigo-600">Trưởng nhóm</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold">Tệp đính kèm</div>
                      {selectedSubmission?.files?.length ? (
                        <div className="text-xs text-gray-500">{selectedSubmission.files.length} tệp</div>
                      ) : null}
                    </div>
                    {selectedSubmission?.files?.length ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {selectedSubmission.files.map((f:any, i:number)=> {
                          const late = !!(dueTs && f.at > dueTs);
                          const fileKey = f.fileKey || f.FileKey || "";
                          const contentType = f.contentType || f.ContentType || "";
                          const fileName = getOriginalNameFromKey(fileKey) || `Tệp #${i + 1}`;
                          const Icon = getFileIcon(fileName, contentType);
                          const iconClass = getFileIconClass(fileName, contentType);
                          const label = getFileLabel(fileName, contentType);
                          return (
                            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-10 w-10 rounded-lg bg-gray-100 dark:bg-zinc-800 ${iconClass} flex items-center justify-center shrink-0`}>
                                  <Icon size={18} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                                      {fileName}
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                                      {label}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {(f.size/1024).toFixed(1)} KB
                                    {late && <span className="ml-2 text-rose-600">Muộn</span>}
                                  </div>
                                </div>
                              </div>
                              <button
                                className="text-xs rounded-md border bg-white dark:bg-zinc-900 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                                onClick={() => openFileViewer({ submissionId: String(f.id), name: fileName })}
                              >
                                Xem
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Chưa nộp</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold">Chấm điểm</div>
                      {selectedSubmission?.gradeStatus === "returned" ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
                          <CheckCircle2 size={14} /> Đã trả
                        </span>
                      ) : selectedSubmission?.grade != null ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5">
                          <CheckCircle2 size={14} /> Đã chấm
                        </span>
                      ) : selectedSubmission?.gradeStatus === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
                          Đang chấm
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-4">
                      <div className="grid gap-3 grid-cols-[100px_minmax(0,1fr)] items-end">
                        <label className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Điểm</div>
                          <input
                            type="number"
                            placeholder={`0..${assignment?.maxPoints ?? 100}`}
                            value={gradeInput as any}
                            onChange={(e)=> setGradeInput(e.target.value)}
                            className="w-full rounded-full border px-4 py-2 text-sm bg-white dark:bg-zinc-950"
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Nhận xét</div>
                          <input
                            type="text"
                            placeholder="Nhận xét"
                            value={feedbackInput}
                            onChange={(e)=> setFeedbackInput(e.target.value)}
                            className="w-full rounded-full border px-4 py-2 text-sm bg-white dark:bg-zinc-950"
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
                        <div className="flex flex-wrap items-center gap-2">
                        
                          <label className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setReturnFile(f);
                                (e.target as HTMLInputElement).value = "";
                              }}
                            />
                            <Paperclip className="h-4 w-4 text-gray-600" />
                            Chọn file đã chấm
                          </label>
                          {returnFile && (
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[240px]">
                              {returnFile.name}
                            </span>
                          )}
                          {selectedSubmission?.returnedFileKey && (
                            <button
                              className="text-xs rounded-full border px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                              onClick={() =>
                                openFileViewer({
                                  key: selectedSubmission.returnedFileKey,
                                  name: selectedSubmission.returnedFileName || "Bài đã chấm",
                                })
                              }
                            >
                              Xem bài đã chấm
                            </button>
                          )}
                        </div>
                        <button
                          className="w-full md:w-auto rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={!selectedSubmission?.files?.length}
                          onClick={async () => {
                          const raw = String(gradeInput ?? "").trim();
                          const inputVal = raw === "" ? NaN : Number(raw);
                          const score = !isNaN(inputVal) ? inputVal : selectedSubmission?.grade;
                          if (score == null || isNaN(Number(score))) {
                            toast.error("Điểm không hợp lệ");
                            return;
                          }
                          const firstId = selectedSubmission?.files?.[0]?.id;
                          if (!firstId) {
                            toast.error("Chưa có bài nộp để chấm");
                            return;
                          }
                          const feedback = feedbackInput || selectedSubmission?.feedback || undefined;
                          try {
                            if (returnFile) {
                              const fd = new FormData();
                              fd.append("file", returnFile);
                              fd.append("grade", String(score));
                              if (feedback) fd.append("feedback", feedback);
                              await api.post(`/grades/${firstId}/return-file`, fd, {
                                headers: { "Content-Type": "multipart/form-data" },
                              });
                              toast.success("Chấm điểm và trả bài thành công");
                              setReturnFile(null);
                            } else {
                              await api.put(`/grades/${firstId}`, { grade: score, feedback, status: "returned" });
                              toast.success("Chấm điểm thành công");
                            }
                            setFeedbackInput("");
                            await loadSubs();
                          } catch (err: any) {
                            const actionLabel = returnFile ? "Chấm điểm và trả bài" : "Chấm điểm";
                            const status = err?.response?.status;
                            if (returnFile && status === 404) {
                              toast.error("API chưa hỗ trợ trả bài. Hãy cập nhật backend hoặc bỏ chọn file để chỉ chấm điểm.");
                              return;
                            }
                            toast.error(
                              err?.response?.data?.message || `${actionLabel} thất bại`
                            );
                          }
                        }}
                        >
                          Chấm điểm
                        </button>
                      </div>
                    </div>
                    {selectedSubmission?.feedback && (
                      <div className="mt-3 text-xs">
                        <div className="rounded-md bg-gray-50 dark:bg-zinc-900 px-3 py-2 text-gray-700 dark:text-gray-300">
                          <div className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500"><MessageSquare size={12}/> Nhận xét</div>
                          <div className="italic">{selectedSubmission?.feedback}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Trao đổi riêng với học viên này (đưa xuống dưới cùng) */}
                  <CommentsPanel assignmentId={id} studentId={selectedCommentUserId} />

                  {/* Nhận xét là chung cho toàn bài: bỏ danh sách theo tệp */}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
