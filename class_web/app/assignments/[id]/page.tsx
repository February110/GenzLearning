"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import api from "@/api/client";
import { resolveAvatar } from "@/utils/resolveAvatar";
import { getSignalR } from "@/lib/signalr";
import CommentsPanel from "@/components/assignments/CommentsPanel";
import { toast } from "react-hot-toast";

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
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [gradeInput, setGradeInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [sending, setSending] = useState(false);
  const dueTs = useMemo(() => {
    const d = (assignment as any)?.dueAt || (assignment as any)?.DueAt;
    return d ? new Date(d).getTime() : null;
  }, [assignment]);

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try { const { data } = await api.get(`/comments/assignment/${id}`); setComments(data || []); } catch {}
    })();
  }, [id]);

  async function load() {
    try {
      const { data } = await api.get(`/assignments/${id}`);
      setAssignment(data);
      try {
        const mats = await api.get(`/assignments/${id}/materials`);
        setAssignment((prev:any)=> ({ ...(prev||{}), materials: mats.data }));
      } catch {}
      await Promise.all([
        detectRole(data?.classroomId || data?.ClassroomId),
        loadSubs(),
        loadMySubs(),
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

  async function handleDeleteSubmission(subId?: string){
    try{
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
      }));
      setStudents(studs);
    }catch{}
  }

  async function submitFile(e: React.FormEvent){
    e.preventDefault();
    if(!files || files.length === 0){ toast.error('Chọn tệp trước'); return; }
    await uploadSelected(files);
  }

  async function uploadSelected(selected: File[]){
    try {
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

  async function openByKey(key: string){
    try{
      const { data } = await api.get(`/submissions/public-url`, { params: { key } });
      window.open(data.url || data.downloadUrl, "_blank");
    }catch{}
  }

  // Removed assignment-level CommentAdded listener. CommentsPanel handles thread-level realtime.

  // Group submissions by student so multiple files show as one row (Google Classroom style)
  const grouped = useMemo(() => {
    const map = new Map<string, any>();
    subs.forEach((s: any) => {
      const userId = (s.userId || s.UserId || "").toString();
      const email = (s.email || s.Email || "").toLowerCase();
      const name = s.studentName || s.StudentName || email || "";
      const size = s.fileSize ?? s.FileSize ?? 0;
      const at = new Date(s.submittedAt || s.SubmittedAt).getTime();
      const id = s.id || s.Id;
      const key = userId || email || name;
      const gradeDetail = (s.gradeDetail || s.GradeDetail || null) as any;
      const gradeStatus = (s.gradeStatus ?? s.GradeStatus ?? gradeDetail?.status ?? gradeDetail?.Status) || null;
      const gradeScore = (s.grade ?? s.Grade ?? gradeDetail?.score ?? gradeDetail?.Score) ?? null;
      const feedback = s.feedback ?? s.Feedback ?? gradeDetail?.feedback ?? gradeDetail?.Feedback ?? null;
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
          files: [{ id, size, at, grade: gradeScore, gradeStatus, feedback }],
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
        g.files.push({ id, size, at, grade: gradeScore, gradeStatus, feedback });
      }
    });
    // sort files per group by time desc
    const arr = Array.from(map.values());
    arr.forEach((g: any) => g.files.sort((a: any, b: any) => b.at - a.at));
    // sort groups by latest time desc
    return arr.sort((a: any, b: any) => b.latestAt - a.latestAt);
  }, [subs]);

  // Map by email for quick lookup
  const byEmail = useMemo(() => {
    const m = new Map<string, any>();
    grouped.forEach((g) => { if (g.userId) m.set(g.userId, g); });
    return m;
  }, [grouped]);

  const stats = useMemo(() => {
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
  }, [students, byEmail, dueTs]);

  const roster = useMemo(()=>{
    return students
      .map((s:any)=>{
        const g = byEmail.get((s.userId||'').toString());
        return { ...s, group:g, submitted: !!g, latestAt: g?.latestAt || 0 };
      })
      .filter(item => filter==='all' ? true : filter==='submitted' ? item.submitted : !item.submitted)
      .sort((a,b)=> b.latestAt - a.latestAt || a.name.localeCompare(b.name));
  }, [students, byEmail, filter]);

  const selectedGroup = useMemo(()=> byEmail.get(selectedEmail), [byEmail, selectedEmail]);

  useEffect(()=>{
    // Auto select first in roster for teacher view
    if(isTeacher && roster.length && !selectedEmail){
      setSelectedEmail((roster[0].userId||'').toString());
    }
  }, [isTeacher, roster, selectedEmail]);

  if (loading) return <div className="p-6"><div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Đang tải...</div></div>;
  if (!assignment) return <div className="p-6"><div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">Không tìm thấy bài tập</div></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">
        <h1 className="text-2xl font-bold">{assignment.title}</h1>
        <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: assignment.instructions || 'Không có hướng dẫn' }} />
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
                  const url = m.url || m.link || (m.path ? resolveAvatar(m.path) : m.filePath ? resolveAvatar(m.filePath) : undefined);
                  const key = m.key || m.fileKey;
                  return (
                    <li key={idx} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                      <div className="truncate text-sm">{m.name || m.fileName || m.originalName || url || key || 'Tài liệu'}</div>
                      {url ? (
                        <a href={url} target="_blank" className="text-indigo-600 text-sm hover:underline">Mở</a>
                      ) : key ? (
                        <button className="text-indigo-600 text-sm hover:underline" onClick={()=>openByKey(key)}>Tải / Xem</button>
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
          <form onSubmit={submitFile} className="flex flex-col gap-4">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800">
                <input multiple type="file" className="hidden" onChange={(e)=> { const list = Array.from(e.target.files || []); if (list.length === 0) return; setFiles(prev => [...prev, ...list]); (e.target as HTMLInputElement).value = ""; }} />
                + Thêm tệp
              </label>
              <button type="submit" disabled={uploading || files.length === 0} className="rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm">
                {uploading ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>

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
                  const lastSlash = (key||'').lastIndexOf('/')
                  const basename = lastSlash >= 0 ? key.slice(lastSlash+1) : key;
                  const parts = (basename||'').split('_');
                  const original = parts.length > 1 ? parts.slice(1).join('_') : basename;
                  return (
                    <div key={s.id || s.Id || i} className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                      <div className="min-w-0 pr-3">
                        <div className="truncate text-gray-800 dark:text-gray-200">{original || 'Tệp'}</div>
                        <div className="text-xs text-gray-500">{ts} • {(size/1024).toFixed(1)} KB</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800" onClick={async()=>{ try{ const { data } = await api.get(`/submissions/public-url`, { params: { key } }); window.open(data.url, '_blank'); }catch{}}}>Xem/Tải</button>
                        <button
                          className="shrink-0 rounded-md border border-red-200 text-red-600 px-3 py-1.5 text-xs hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-lg font-semibold">Bài tập của học viên</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">Đã nộp: {stats.submitted}</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Chưa nộp: {stats.notSubmitted}</span>
              <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700">Đã chấm: {stats.graded}</span>
              {dueTs && (<span className="px-2 py-1 rounded bg-rose-50 text-rose-600">Nộp muộn: {stats.late}</span>)}
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Tổng: {stats.total}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Left roster */}
            <div className="border-r border-gray-100 dark:border-gray-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Tất cả học viên</div>
                <select value={filter} onChange={(e)=> setFilter(e.target.value as any)} className="text-xs border rounded-md px-2 py-1 bg-white dark:bg-zinc-900">
                  <option value="all">Tất cả</option>
                  <option value="submitted">Đã nộp</option>
                  <option value="assigned">Chưa nộp</option>
                </select>
              </div>
              <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
                {roster.map((r:any, idx:number)=>{
                  const email = (r.email||'').toLowerCase();
                  const uid = (r.userId||'').toString();
                  const active = selectedEmail === uid;
                  const g = r.group;
                  const keyStable = r.userId || email || r.name || String(idx);
                  const isLate = !!(dueTs && g && g.latestAt > dueTs);
                  return (
                    <button key={keyStable} onClick={()=>{ setSelectedEmail(uid); setGradeInput(g?.grade ?? ''); setFeedbackInput(''); }} className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900'}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className={`h-2 w-2 rounded-full ${g ? (isLate ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-gray-300'}`} title={g ? (isLate ? 'Nộp muộn' : 'Đã nộp') : 'Chưa nộp'} />
                      </div>
                      <div className="text-xs text-gray-500 truncate">{r.email}</div>
                      <div className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                        {g ? (
                          <>
                            {`${g.files.length} tệp • ${(g.totalSize/1024).toFixed(1)} KB • ${new Date(g.latestAt).toLocaleString()}`}
                            {isLate && <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 text-rose-600 px-2 py-0.5">Muộn</span>}
                          </>
                        ) : 'Chưa nộp'}
                      </div>
                      {g && (
                        <div className="text-xs text-gray-500">
                          {g.grade != null
                            ? `Điểm: ${g.grade}`
                            : g.gradeStatus === "pending"
                            ? "Đang chấm"
                            : "Chưa chấm"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right detail */}
            <div className="lg:col-span-2 p-5">
              {!selectedEmail ? (
                <div className="text-gray-500">Chọn một học viên để xem chi tiết.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-semibold flex items-center gap-2">
                        {students.find(s=> (s.userId||'').toString()===selectedEmail)?.name}
                        {!selectedGroup && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">Chưa nộp</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{students.find(s=> (s.userId||'').toString()===selectedEmail)?.email || '-'}</div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedGroup && selectedGroup.grade != null
                        ? `Điểm: ${selectedGroup.grade}`
                        : selectedGroup?.gradeStatus === "pending"
                        ? "Đang chấm"
                        : "Chưa chấm"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Tệp đính kèm</div>
                    {selectedGroup?.files?.length ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {selectedGroup.files.map((f:any, i:number)=> {
                          const late = !!(dueTs && f.at > dueTs);
                          return (
                            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between">
                              <div className="text-xs truncate">#{i+1} • {(f.size/1024).toFixed(1)} KB {late && <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 text-rose-600 px-2 py-0.5">Muộn</span>}</div>
                              <button className="text-xs rounded-md border px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={async()=>{ try{ const { data } = await api.get(`/submissions/${f.id}/download`); window.open(data.downloadUrl, '_blank'); }catch{} }}>Tải</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Chưa nộp</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Chấm điểm</div>
                      {selectedGroup?.grade != null ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
                          <CheckCircle2 size={14} /> Đã chấm
                        </span>
                      ) : selectedGroup?.gradeStatus === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
                          Đang chấm
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" placeholder={`0..${assignment?.maxPoints ?? 100}`} value={gradeInput as any} onChange={(e)=> setGradeInput(e.target.value)} className="w-28 rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-950" />
                      <input type="text" placeholder="Nhận xét (tuỳ chọn)" value={feedbackInput} onChange={(e)=> setFeedbackInput(e.target.value)} className="flex-1 min-w-[220px] rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-950" />
                      <button
                        className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={!selectedGroup?.files?.length}
                        onClick={async()=>{
                        const val = Number(gradeInput);
                        if(isNaN(val)) { toast.error('Điểm không hợp lệ'); return; }
                        const firstId = selectedGroup?.files?.[0]?.id;
                        if(!firstId){ toast.error('Chưa có bài nộp để chấm'); return; }
                        try { await api.put(`/grades/${firstId}`, { grade: val, feedback: feedbackInput || undefined, status: "graded" }); toast.success('Chấm điểm thành công'); setFeedbackInput(''); await loadSubs(); } catch(err:any){ toast.error(err?.response?.data?.message || 'Chấm điểm thất bại'); }
                     }}>Lưu điểm</button>
                    </div>
                    {selectedGroup?.feedback && (
                      <div className="mt-3 text-xs">
                        <div className="rounded-md bg-gray-50 dark:bg-zinc-900 px-3 py-2 text-gray-700 dark:text-gray-300">
                          <div className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500"><MessageSquare size={12}/> Nhận xét</div>
                          <div className="italic">{selectedGroup?.feedback}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Trao đổi riêng với học viên này (đưa xuống dưới cùng) */}
                  <CommentsPanel assignmentId={id} studentId={selectedEmail} />

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
