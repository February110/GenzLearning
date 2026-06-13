"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import api from "@/api/client";
import { toast } from "react-hot-toast";

type QuizOption = {
  id: string;
  content: string;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId?: string;
  explanation?: string;
};

type QuizData = {
  assignmentId?: string;
  title: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  questions: QuizQuestion[];
};

type QuizAssignmentViewProps = {
  assignmentId: string;
  assignment: any;
  isTeacher: boolean;
};

function normalizeQuiz(payload: any): QuizData | null {
  const root = payload?.data ?? payload?.Data ?? payload ?? {};
  const quiz = root.quiz ?? root.Quiz ?? root;
  if (!quiz) return null;
  const questions = Array.isArray(quiz.questions ?? quiz.Questions) ? quiz.questions ?? quiz.Questions : [];

  return {
    assignmentId: String(quiz.assignmentId ?? quiz.AssignmentId ?? root.id ?? root.Id ?? ""),
    title: String(quiz.title ?? quiz.Title ?? root.title ?? root.Title ?? "Bài trắc nghiệm"),
    topic: String(quiz.topic ?? quiz.Topic ?? ""),
    difficulty: String(quiz.difficulty ?? quiz.Difficulty ?? ""),
    questionCount: Number(quiz.questionCount ?? quiz.QuestionCount ?? questions.length),
    questions: questions.map((q: any) => ({
      id: String(q.id ?? q.Id ?? ""),
      question: String(q.question ?? q.Question ?? ""),
      correctOptionId: q.correctOptionId ?? q.CorrectOptionId,
      explanation: q.explanation ?? q.Explanation,
      options: (Array.isArray(q.options ?? q.Options) ? q.options ?? q.Options : []).map((o: any) => ({
        id: String(o.id ?? o.Id ?? ""),
        content: String(o.content ?? o.Content ?? ""),
      })),
    })),
  };
}

export default function QuizAssignmentView({ assignmentId, assignment, isTeacher }: QuizAssignmentViewProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(String(assignment?.status ?? assignment?.Status ?? "published"));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const endpoint = isTeacher ? `/teacher/assignments/${assignmentId}` : `/student/assignments/${assignmentId}`;
        const { data } = await api.get(endpoint);
        if (!active) return;
        setQuiz(normalizeQuiz(data));
        const root = data?.data ?? data?.Data ?? {};
        const submission = root.submission ?? root.Submission ?? null;
        if (submission) {
          setResult({
            correctCount: submission.correctCount ?? submission.CorrectCount,
            totalQuestions: submission.totalQuestions ?? submission.TotalQuestions,
            score: submission.score ?? submission.Score,
            submittedAt: submission.submittedAt ?? submission.SubmittedAt,
          });
        }
        setStatus(String(root.status ?? root.Status ?? assignment?.status ?? assignment?.Status ?? "published"));
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Không tải được bài trắc nghiệm.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [assignmentId, assignment, isTeacher]);

  async function submitQuiz() {
    if (!quiz || result) return;
    const missing = quiz.questions.filter((q) => !answers[q.id]);
    if (missing.length > 0) {
      toast.error("Vui lòng trả lời tất cả câu hỏi trước khi nộp.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id],
        })),
      };
      const { data } = await api.post(`/student/assignments/${assignmentId}/submit`, payload);
      setResult(data?.data ?? data?.Data ?? null);
      toast.success("Nộp bài thành công.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Nộp bài thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function publishQuiz() {
    try {
      setPublishing(true);
      await api.post(`/assignments/${assignmentId}/publish`);
      setStatus("published");
      toast.success("Đã giao bài trắc nghiệm.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Giao bài thất bại.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-zinc-900">
          Đang tải bài trắc nghiệm...
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
          Không tìm thấy dữ liệu trắc nghiệm.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                Trắc nghiệm
              </span>
              {status === "draft" && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Nháp</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
              {quiz.topic && <span>Chủ đề: {quiz.topic}</span>}
              {quiz.difficulty && <span>· Mức độ: {quiz.difficulty}</span>}
              <span>· {quiz.questions.length} câu</span>
              {(assignment?.quizTimeLimitMinutes ?? assignment?.QuizTimeLimitMinutes) && (
                <span>· {assignment.quizTimeLimitMinutes ?? assignment.QuizTimeLimitMinutes} phút</span>
              )}
            </div>
          </div>

          {isTeacher && status === "draft" && (
            <button
              type="button"
              disabled={publishing}
              onClick={publishQuiz}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {publishing ? "Đang giao..." : "Giao bài"}
            </button>
          )}
        </div>

        {result && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Điểm: {result.score ?? result.Score}/10
            </div>
            <div className="mt-1 text-sm">
              Đúng {result.correctCount ?? result.CorrectCount}/{result.totalQuestions ?? result.TotalQuestions} câu.
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {quiz.questions.map((question, index) => (
          <div key={question.id || index} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-zinc-900">
            <div className="font-semibold text-gray-900 dark:text-white">
              Câu {index + 1}: {question.question}
            </div>
            <div className="mt-3 space-y-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                const correct = isTeacher && question.correctOptionId === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      correct
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    {!isTeacher && !result && (
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      />
                    )}
                    <span className="font-semibold">{option.id}.</span>
                    <span>{option.content}</span>
                    {correct && <span className="ml-auto text-xs font-semibold">Đáp án đúng</span>}
                  </label>
                );
              })}
            </div>
            {isTeacher && question.explanation && (
              <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-zinc-950 dark:text-gray-300">
                Giải thích: {question.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isTeacher && !result && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={submitQuiz}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </button>
        </div>
      )}
    </div>
  );
}
