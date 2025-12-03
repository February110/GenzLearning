"use client";

import RichTextEditor from "@/components/common/RichTextEditor";
import React, { Dispatch, SetStateAction } from "react";

type FormState = {
  title: string;
  instructions: string;
  dueAt: string;
  maxPoints: number;
};

interface AssignmentEditModalProps {
  editing: any | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  links: string[];
  setLinks: Dispatch<SetStateAction<string[]>>;
  linkInput: string;
  setLinkInput: Dispatch<SetStateAction<string>>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export default function AssignmentEditModal({
  editing,
  form,
  setForm,
  files,
  setFiles,
  links,
  setLinks,
  linkInput,
  setLinkInput,
  onSubmit,
  onClose,
}: AssignmentEditModalProps) {
  if (!editing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 p-6">
        <div className="text-lg font-semibold mb-4">Chỉnh sửa bài tập</div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <input
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Tiêu đề *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <RichTextEditor value={form.instructions} onChange={(html) => setForm({ ...form, instructions: html })} placeholder="Hướng dẫn (không bắt buộc)" />
            <div className="rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-sm font-medium">Đính kèm</div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800">
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []);
                        setFiles([...files, ...list]);
                      }}
                    />
                    📤 Tải lên
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="Dán liên kết và nhấn Thêm"
                      className="rounded-md border px-3 py-1.5 text-sm w-64"
                    />
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
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
                {(files.length > 0 || links.length > 0) && (
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="truncate">
                          {f.name} <span className="text-xs text-gray-500">({(f.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                          Xóa
                        </button>
                      </div>
                    ))}
                    {links.map((u, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <a href={u} target="_blank" className="truncate text-indigo-600 hover:underline" rel="noreferrer">
                          {u}
                        </a>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => setLinks(links.filter((_, idx) => idx !== i))}>
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Điểm tối đa</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={form.maxPoints}
                onChange={(e) => setForm({ ...form, maxPoints: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Hạn nộp</label>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Hủy
              </button>
              <button type="submit" className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm">
                Lưu
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
