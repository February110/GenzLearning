"use client";

import RichTextEditor from "@/components/common/RichTextEditor";
import api from "@/api/client";
import { normalizeLectureTree, type LectureSection } from "@/lib/lectures";
import { Plus, Trash2, Upload } from "lucide-react";
import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type FormState = {
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
};

type QuizOption = {
  id: string;
  content: string;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
};

type QuizData = {
  title: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  questions: QuizQuestion[];
};

type AssignmentReuseDraft = {
  sourceId: string;
  title: string;
  instructions?: string | null;
  dueAt?: string | null;
  maxPoints?: number;
  allowedFileTypes?: string | null;
  maxFileSizeMb?: number | "";
  groupEnabled?: boolean;
  groupMinMembers?: number | "";
  groupMaxMembers?: number | "";
  groupMode?: "student" | "random";
  assignmentType?: string;
  materials?: any[];
};

interface AssignmentCreateModalProps {
  open: boolean;
  creating: boolean;
  classroomId: string;
  draft?: AssignmentReuseDraft | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  attachFiles: File[];
  setAttachFiles: Dispatch<SetStateAction<File[]>>;
  links: string[];
  setLinks: Dispatch<SetStateAction<string[]>>;
  linkInput: string;
  setLinkInput: Dispatch<SetStateAction<string>>;
  aiSource: string;
  setAiSource: Dispatch<SetStateAction<string>>;
  aiCount: number;
  setAiCount: Dispatch<SetStateAction<number>>;
  aiGenerating: boolean;
  aiResults: { question: string; options: string[]; answer: string; explanation?: string }[];
  onGenerateQuiz: () => void;
  onInsertQuiz: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onSaved?: () => void;
}

const optionIds = ["A", "B", "C", "D"];

function createEmptyQuestion(index: number): QuizQuestion {
  return {
    id: `q${index + 1}`,
    question: "",
    options: optionIds.map((id) => ({ id, content: "" })),
    correctOptionId: "A",
    explanation: "",
  };
}

function normalizeQuizData(payload: any, fallbackTitle: string, fallbackTopic: string, fallbackDifficulty: string): QuizData {
  const source = payload?.data ?? payload?.Data ?? payload ?? {};
  const questions = Array.isArray(source.questions ?? source.Questions) ? source.questions ?? source.Questions : [];

  const normalizedQuestions = questions.map((q: any, index: number) => {
    const rawOptions = Array.isArray(q.options ?? q.Options) ? q.options ?? q.Options : [];
    const options = optionIds.map((id, optionIndex) => {
      const found = rawOptions.find((opt: any) => String(opt.id ?? opt.Id ?? "").toUpperCase() === id) ?? rawOptions[optionIndex];
      return {
        id,
        content: String(found?.content ?? found?.Content ?? ""),
      };
    });

    return {
      id: String(q.id ?? q.Id ?? `q${index + 1}`),
      question: String(q.question ?? q.Question ?? ""),
      options,
      correctOptionId: String(q.correctOptionId ?? q.CorrectOptionId ?? "A").toUpperCase(),
      explanation: String(q.explanation ?? q.Explanation ?? ""),
    };
  });

  return {
    title: String(source.title ?? source.Title ?? fallbackTitle),
    topic: String(source.topic ?? source.Topic ?? fallbackTopic),
    difficulty: String(source.difficulty ?? source.Difficulty ?? fallbackDifficulty),
    questionCount: normalizedQuestions.length,
    questions: normalizedQuestions,
  };
}

export default function AssignmentCreateModal({
  open,
  creating,
  classroomId,
  draft,
  form,
  setForm,
  attachFiles,
  setAttachFiles,
  links,
  setLinks,
  linkInput,
  setLinkInput,
  onSubmit,
  onClose,
  onSaved,
}: AssignmentCreateModalProps) {
  const [mode, setMode] = useState<"standard" | "ai_quiz">("standard");
  const [questionSource, setQuestionSource] = useState<"manual" | "file" | "lecture">("manual");
  const [topic, setTopic] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState("");
  const [lectureSections, setLectureSections] = useState<LectureSection[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [selectedLectureLessonId, setSelectedLectureLessonId] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Trung bình");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | "">(30);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const reuseMode = !!draft?.sourceId;
  const reuseMaterials = Array.isArray(draft?.materials) ? draft.materials : [];
  const reuseIsQuiz = String(draft?.assignmentType || "").toLowerCase() === "ai_quiz";

  useEffect(() => {
    if (open && reuseMode) setMode("standard");
  }, [open, reuseMode]);

  useEffect(() => {
    if (!open || reuseMode) return;

    let active = true;
    async function loadLectures() {
      try {
        setLecturesLoading(true);
        const { data } = await api.get(`/classrooms/${classroomId}/lectures/tree`);
        if (active) setLectureSections(normalizeLectureTree(data));
      } catch {
        if (active) toast.error("Không tải được danh sách bài giảng.");
      } finally {
        if (active) setLecturesLoading(false);
      }
    }

    loadLectures();
    return () => {
      active = false;
    };
  }, [open, classroomId, reuseMode]);

  if (!open) return null;

  function findLectureLesson(lessonId: string) {
    for (const section of lectureSections) {
      const lesson = section.lessons.find((item) => item.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  }

  function handleLectureLessonChange(lessonId: string) {
    setSelectedLectureLessonId(lessonId);
    const lesson = findLectureLesson(lessonId);
    if (lesson && !topic.trim()) setTopic(lesson.title);
  }

  async function generateAiQuiz() {
    if (!form.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề bài tập.");
      return;
    }
    if (questionSource === "lecture" && !selectedLectureLessonId) {
      toast.error("Vui lòng chọn bài giảng.");
      return;
    }

    const selectedLesson = questionSource === "lecture" ? findLectureLesson(selectedLectureLessonId) : null;
    const effectiveTopic = topic.trim() || selectedLesson?.title?.trim() || "";
    if (!effectiveTopic) {
      toast.error("Vui lòng nhập chủ đề bài học.");
      return;
    }
    if (questionSource === "manual" && !lessonContent.trim()) {
      toast.error("Vui lòng nhập nội dung bài học.");
      return;
    }
    if (questionSource === "file" && !sourceFile) {
      toast.error("Vui lòng chọn file tài liệu.");
      return;
    }

    try {
      setAiBusy(true);
      let data: any;
      if (questionSource === "file" && sourceFile) {
        const payload = new FormData();
        payload.append("title", form.title.trim());
        payload.append("topic", effectiveTopic);
        payload.append("difficulty", difficulty);
        payload.append("numberOfQuestions", String(questionCount));
        payload.append("answersPerQuestion", "4");
        payload.append("file", sourceFile);

        const response = await api.post("/ai/generate-quiz-from-file", payload);
        data = response.data;
      } else if (questionSource === "lecture") {
        const response = await api.post("/ai/generate-quiz-from-lecture", {
          classroomId,
          lessonId: selectedLectureLessonId,
          title: form.title.trim(),
          topic: effectiveTopic,
          numberOfQuestions: questionCount,
          difficulty,
          answersPerQuestion: 4,
        });
        data = response.data;
      } else {
        const response = await api.post("/ai/generate-quiz", {
          title: form.title.trim(),
          topic: effectiveTopic,
          lessonContent: lessonContent.trim(),
          numberOfQuestions: questionCount,
          difficulty,
          answersPerQuestion: 4,
        });
        data = response.data;
      }
      setQuizData(normalizeQuizData(data, form.title.trim(), effectiveTopic, difficulty));
      toast.success("Đã sinh câu hỏi.");
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      toast.error(Array.isArray(errors) && errors.length ? errors[0] : err?.response?.data?.message || "Sinh câu hỏi thất bại.");
    } finally {
      setAiBusy(false);
    }
  }

  function handleSourceFileChange(file: File | null) {
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const supportedExts = ["txt", "md", "csv", "json", "pdf", "docx"];
    const isSupported = file.type.startsWith("text/") || supportedExts.includes(ext);

    if (!isSupported) {
      toast.error("Chỉ hỗ trợ file TXT, PDF, DOCX hoặc file text phổ biến.");
      return;
    }

    setSourceFile(file);
    setSourceFileName(fileName);
    toast.success("Đã chọn file. Backend sẽ trích xuất nội dung khi sinh câu hỏi.");
  }

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuizData((prev) => {
      if (!prev) return prev;
      const questions = [...prev.questions];
      questions[index] = { ...questions[index], ...patch };
      return { ...prev, questionCount: questions.length, questions };
    });
  }

  function updateOption(questionIndex: number, optionId: string, content: string) {
    setQuizData((prev) => {
      if (!prev) return prev;
      const questions = [...prev.questions];
      const question = questions[questionIndex];
      questions[questionIndex] = {
        ...question,
        options: question.options.map((option) => (option.id === optionId ? { ...option, content } : option)),
      };
      return { ...prev, questions };
    });
  }

  function deleteQuestion(index: number) {
    setQuizData((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, id: `q${i + 1}` }));
      return { ...prev, questionCount: questions.length, questions };
    });
  }

  function addManualQuestion() {
    setQuizData((prev) => {
      const base = prev ?? {
        title: form.title.trim(),
        topic: topic.trim(),
        difficulty,
        questionCount: 0,
        questions: [],
      };
      const questions = [...base.questions, createEmptyQuestion(base.questions.length)];
      return { ...base, questionCount: questions.length, questions };
    });
  }

  async function saveAiQuiz(publish: boolean) {
    if (!quizData || quizData.questions.length === 0) {
      toast.error("Chưa có câu hỏi để lưu.");
      return;
    }

    try {
      setSavingQuiz(true);
      await api.post("/assignments/save-ai-quiz", {
        classId: classroomId,
        title: form.title.trim() || quizData.title,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        maxPoints: 10,
        timeLimitMinutes: timeLimitMinutes === "" ? null : Number(timeLimitMinutes),
        publish,
        quizData: {
          ...quizData,
          title: form.title.trim() || quizData.title,
          topic: topic.trim() || quizData.topic,
          difficulty,
          questionCount: quizData.questions.length,
        },
      });
      toast.success(publish ? "Đã lưu và giao bài trắc nghiệm." : "Đã lưu nháp bài trắc nghiệm.");
      onSaved?.();
      onClose();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      toast.error(Array.isArray(errors) && errors.length ? errors[0] : err?.response?.data?.message || "Lưu bài trắc nghiệm thất bại.");
    } finally {
      setSavingQuiz(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-[1150px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold">{reuseMode ? "Đăng lại bài tập" : "Tạo bài tập"}</div>
          {!reuseMode && (
            <div className="inline-flex w-fit rounded-full border border-gray-200 bg-gray-50 p-1 text-sm dark:border-gray-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setMode("standard")}
                className={`rounded-full px-4 py-1.5 ${mode === "standard" ? "bg-white text-indigo-700 shadow-sm dark:bg-zinc-800" : "text-gray-600 dark:text-gray-300"}`}
              >
                Nộp file
              </button>
              <button
                type="button"
                onClick={() => setMode("ai_quiz")}
                className={`rounded-full px-4 py-1.5 ${mode === "ai_quiz" ? "bg-white text-indigo-700 shadow-sm dark:bg-zinc-800" : "text-gray-600 dark:text-gray-300"}`}
              >
                Trắc nghiệm
              </button>
            </div>
          )}
        </div>

        {reuseMode || mode === "standard" ? (
          <form onSubmit={onSubmit} className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <input
                disabled={creating}
                className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-950"
                placeholder="Tiêu đề *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <RichTextEditor
                disabled={creating}
                value={form.instructions}
                onChange={(html) => setForm({ ...form, instructions: html })}
                placeholder="Hướng dẫn (không bắt buộc)"
              />
              {reuseMode ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                    {reuseIsQuiz ? "Dữ liệu trắc nghiệm sẽ được sao chép" : "Đính kèm sẽ được sao chép"}
                  </div>
                  {reuseMaterials.length === 0 ? (
                    <div>{reuseIsQuiz ? "Bộ câu hỏi của bài gốc sẽ được dùng cho bài đăng lại." : "Không có tệp đính kèm."}</div>
                  ) : (
                    <ul className="space-y-1">
                      {reuseMaterials.map((m, i) => (
                        <li key={i} className="truncate">
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                            {m.name || m.url || "Tệp đính kèm"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!reuseIsQuiz && reuseMaterials.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">Các tệp và liên kết sẽ được sao chép sang bài tập mới.</div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="border-b border-gray-100 px-4 py-2 text-sm font-medium dark:border-gray-800">Đính kèm</div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${creating ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"}`}>
                        <input
                          disabled={creating}
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            const list = Array.from(e.target.files || []);
                            setAttachFiles([...attachFiles, ...list]);
                          }}
                        />
                        <Upload className="h-4 w-4 text-indigo-600" />
                        Tải lên
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          disabled={creating}
                          value={linkInput}
                          onChange={(e) => setLinkInput(e.target.value)}
                          placeholder="Dán liên kết và nhấn Thêm"
                          className="w-64 rounded-full border px-4 py-1.5 text-sm disabled:opacity-60"
                        />
                        <button
                          type="button"
                          disabled={creating}
                          className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-zinc-800"
                          onClick={() => {
                            if (linkInput.trim()) {
                              setLinks([...links, linkInput.trim()]);
                              setLinkInput("");
                            }
                          }}
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                    {(attachFiles.length > 0 || links.length > 0) && (
                      <div className="space-y-2">
                        {attachFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                            <div className="truncate">
                              {f.name} <span className="text-xs text-gray-500">({(f.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button type="button" disabled={creating} className="text-red-600 hover:underline disabled:opacity-50" onClick={() => setAttachFiles(attachFiles.filter((_, idx) => idx !== i))}>
                              Xóa
                            </button>
                          </div>
                        ))}
                        {links.map((u, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                            <a href={u} target="_blank" className="truncate text-indigo-600 hover:underline" rel="noreferrer">
                              {u}
                            </a>
                            <button type="button" disabled={creating} className="text-red-600 hover:underline disabled:opacity-50" onClick={() => setLinks(links.filter((_, idx) => idx !== i))}>
                              Xóa
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 lg:min-w-[380px] lg:max-w-[420px]">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Điểm tối đa</label>
                <input disabled={creating} type="number" min={1} className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-950" value={form.maxPoints} onChange={(e) => setForm({ ...form, maxPoints: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Hạn nộp</label>
                <input disabled={creating} type="datetime-local" className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-950" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Định dạng nộp (đuôi file)</label>
                <input disabled={creating} type="text" placeholder="Ví dụ: jpg, png, zip, rar" className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-950" value={form.allowedFileTypes} onChange={(e) => setForm({ ...form, allowedFileTypes: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Dung lượng tối đa mỗi tệp (MB)</label>
                <input disabled={creating} type="number" min={1} placeholder="Ví dụ: 100" className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-950" value={form.maxFileSizeMb} onChange={(e) => setForm({ ...form, maxFileSizeMb: e.target.value === "" ? "" : Number(e.target.value) })} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-zinc-950">
                <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Hình thức bài tập</div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input disabled={creating} type="radio" name="assignmentType" checked={!form.groupEnabled} onChange={() => setForm({ ...form, groupEnabled: false })} />
                    Bài tập cá nhân
                  </label>
                  <label className="flex items-center gap-2">
                    <input disabled={creating} type="radio" name="assignmentType" checked={form.groupEnabled} onChange={() => setForm({ ...form, groupEnabled: true, groupMode: "random", groupMinMembers: form.groupMinMembers === "" ? 2 : form.groupMinMembers })} />
                    Bài tập theo nhóm
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                  Hủy
                </button>
                <button type="submit" disabled={creating} className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60">
                  {creating ? (reuseMode ? "Đang đăng lại..." : "Đang tạo...") : reuseMode ? "Đăng lại" : "Tạo"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Tiêu đề bài tập *"
                  className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-950"
                />
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Chủ đề bài học *"
                  className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-950"
                />
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-zinc-950">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Nguồn tạo câu hỏi</div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="questionSource"
                        checked={questionSource === "manual"}
                        onChange={() => setQuestionSource("manual")}
                      />
                      Từ nội dung nhập tay
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="questionSource"
                        checked={questionSource === "file"}
                        onChange={() => setQuestionSource("file")}
                      />
                      Từ file tài liệu
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="questionSource"
                        checked={questionSource === "lecture"}
                        onChange={() => setQuestionSource("lecture")}
                      />
                      Từ bài giảng
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Câu hỏi sẽ chỉ được tạo dựa trên nội dung được nhập, file đã tải lên hoặc bài giảng được chọn.
                  </div>
                  {questionSource === "file" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                        <Upload className="h-4 w-4 text-indigo-600" />
                        Chọn file tài liệu
                        <input
                          type="file"
                          accept=".txt,.md,.csv,.json,.pdf,.docx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleSourceFileChange(file);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {sourceFileName && (
                        <span className="max-w-full truncate text-sm text-gray-600 dark:text-gray-300">
                          {sourceFileName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {questionSource === "manual" ? (
                  <textarea
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    rows={10}
                    placeholder="Nhập nội dung bài học để tạo câu hỏi..."
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-zinc-950"
                  />
                ) : questionSource === "lecture" ? (
                  <div className="space-y-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-zinc-950">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Chọn bài giảng</label>
                    <select
                      value={selectedLectureLessonId}
                      disabled={lecturesLoading}
                      onChange={(e) => handleLectureLessonChange(e.target.value)}
                      className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-zinc-900"
                    >
                      <option value="">{lecturesLoading ? "Đang tải bài giảng..." : "Chọn bài giảng trong lớp"}</option>
                      {lectureSections.map((section) => (
                        <optgroup key={section.id} label={section.title}>
                          {section.lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              {lesson.title}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {!lecturesLoading && lectureSections.reduce((total, section) => total + section.lessons.length, 0) === 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Lớp này chưa có bài giảng để chọn.
                      </div>
                    )}
                    {selectedLectureLessonId && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Nội dung bài giảng được lấy từ phần mô tả/nội dung của bài học đã chọn.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Số câu hỏi</span>
                    <input type="number" min={1} max={30} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full rounded-full border px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Mức độ</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-full border px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900">
                      <option>Dễ</option>
                      <option>Trung bình</option>
                      <option>Khó</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Thời gian làm bài (phút)</span>
                    <input type="number" min={1} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-full border px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-gray-500">Hạn nộp</span>
                    <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className="w-full rounded-full border px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" disabled={aiBusy || savingQuiz} onClick={generateAiQuiz} className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60">
                    {aiBusy ? "Đang sinh..." : quizData ? "Sinh lại" : "Sinh câu hỏi"}
                  </button>
                  <button type="button" disabled={savingQuiz} onClick={addManualQuestion} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-white disabled:opacity-60 dark:border-gray-700 dark:hover:bg-zinc-900">
                    <Plus className="h-4 w-4" />
                    Thêm câu thủ công
                  </button>
                </div>
              </div>
            </div>

            {quizData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Danh sách câu hỏi ({quizData.questions.length})</div>
                </div>
                <div className="space-y-3">
                  {quizData.questions.map((question, questionIndex) => (
                    <div key={question.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-zinc-950">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="mt-2 text-sm font-semibold text-gray-500">Câu {questionIndex + 1}</div>
                        <textarea
                          value={question.question}
                          onChange={(e) => updateQuestion(questionIndex, { question: e.target.value })}
                          rows={2}
                          className="min-h-16 flex-1 rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900"
                          placeholder="Nội dung câu hỏi"
                        />
                        <button type="button" onClick={() => deleteQuestion(questionIndex)} className="rounded-full border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900/70">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {question.options.map((option) => (
                          <label key={option.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctOptionId === option.id}
                              onChange={() => updateQuestion(questionIndex, { correctOptionId: option.id })}
                            />
                            <span className="w-5 shrink-0 text-sm font-semibold">{option.id}</span>
                            <input
                              value={option.content}
                              onChange={(e) => updateOption(questionIndex, option.id, e.target.value)}
                              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                              placeholder={`Đáp án ${option.id}`}
                            />
                          </label>
                        ))}
                      </div>
                      <input
                        value={question.explanation || ""}
                        onChange={(e) => updateQuestion(questionIndex, { explanation: e.target.value })}
                        className="mt-3 w-full rounded-full border px-4 py-2 text-sm dark:border-gray-700 dark:bg-zinc-900"
                        placeholder="Giải thích ngắn gọn cho giáo viên"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                Hủy
              </button>
              <button type="button" disabled={savingQuiz || !quizData} onClick={() => saveAiQuiz(false)} className="rounded-full border border-indigo-200 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:text-indigo-300">
                {savingQuiz ? "Đang lưu..." : "Lưu nháp"}
              </button>
              <button type="button" disabled={savingQuiz || !quizData} onClick={() => saveAiQuiz(true)} className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60">
                Lưu và giao bài
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
