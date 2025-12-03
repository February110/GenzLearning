"use client";

import RichTextEditor from "@/components/common/RichTextEditor";
import { Upload } from "lucide-react";
import React, { Dispatch, SetStateAction } from "react";

type FormState = {
  title: string;
  instructions: string;
  dueAt: string;
  maxPoints: number;
};

interface AssignmentCreateModalProps {
  open: boolean;
  creating: boolean;
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
}

export default function AssignmentCreateModal({
  open,
  creating,
  form,
  setForm,
  attachFiles,
  setAttachFiles,
  links,
  setLinks,
  linkInput,
  setLinkInput,
  aiSource,
  setAiSource,
  aiCount,
  setAiCount,
  aiGenerating,
  aiResults,
  onGenerateQuiz,
  onInsertQuiz,
  onSubmit,
  onClose,
}: AssignmentCreateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[1150px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6 overflow-hidden">
        <div className="text-lg font-semibold mb-4">Tạo bài tập</div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start min-w-0">
          <div className="space-y-3">
            <input
              disabled={creating}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
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
            <div className="rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-sm font-medium">Đính kèm</div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      creating ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
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
                      className="rounded-md border px-3 py-1.5 text-sm w-64 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={creating}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
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
                      <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="truncate">
                          {f.name} <span className="text-xs text-gray-500">({(f.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          disabled={creating}
                          className="text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => setAttachFiles(attachFiles.filter((_, idx) => idx !== i))}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                    {links.map((u, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <a href={u} target="_blank" className="truncate text-indigo-600 hover:underline" rel="noreferrer">
                          {u}
                        </a>
                        <button
                          type="button"
                          disabled={creating}
                          className="text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3 lg:min-w-[380px] lg:max-w-[420px]">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Điểm tối đa</label>
              <input
                disabled={creating}
                type="number"
                min={1}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
                value={form.maxPoints}
                onChange={(e) => setForm({ ...form, maxPoints: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Hạn nộp</label>
              <input
                disabled={creating}
                type="datetime-local"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </div>
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-zinc-950 p-3 space-y-3 shadow-sm">
              <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Sinh câu hỏi trắc nghiệm (AI)</div>
              <textarea
                disabled={creating || aiGenerating}
                className="w-full rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-60"
                rows={6}
                placeholder="Dán nội dung tài liệu..."
                value={aiSource}
                onChange={(e) => setAiSource(e.target.value)}
              />
              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                <label className="flex items-center gap-2">
                  <span>Số câu:</span>
                  <input
                    disabled={creating || aiGenerating}
                    type="number"
                    min={3}
                    max={15}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-20 rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={creating || aiGenerating || !aiSource.trim()}
                    className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs hover:bg-indigo-700 disabled:opacity-50"
                    onClick={onGenerateQuiz}
                  >
                    {aiGenerating ? "Đang sinh..." : "Tạo câu hỏi"}
                  </button>
                </div>
              </div>
              {aiResults.length > 0 && (
                <div className="space-y-1 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-indigo-700 dark:text-indigo-200">Đã sinh {aiResults.length} câu hỏi</span>
                    <button
                      type="button"
                      className="text-xs text-indigo-600 dark:text-indigo-300 underline"
                      onClick={onInsertQuiz}
                    >
                      Chèn vào hướng dẫn
                    </button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {aiResults.map((q, idx) => (
                      <div key={idx} className="rounded border border-indigo-100 dark:border-indigo-800 p-2 bg-white dark:bg-zinc-900">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          Câu {idx + 1}: {q.question}
                        </div>
                        <ul className="list-disc ml-5 text-gray-700 dark:text-gray-300">
                          {q.options?.map((opt, i) => (
                            <li key={i} className={opt === q.answer ? "font-semibold text-emerald-600" : ""}>
                              {opt}
                            </li>
                          ))}
                        </ul>
                        {q.explanation && (
                          <div className="text-xs text-gray-500 mt-1">Giải thích: {q.explanation}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Hủy
              </button>
              <button type="submit" disabled={creating} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm disabled:opacity-60">
                {creating ? "Đang tạo..." : "Tạo"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
