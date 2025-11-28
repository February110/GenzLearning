"use client";

import { useEffect, useRef } from "react";
import {
  Bold as IconBold,
  Italic as IconItalic,
  Underline as IconUnderline,
  Strikethrough as IconStrikethrough,
  List as IconList,
  ListOrdered as IconListOrdered,
  AlignLeft as IconAlignLeft,
  AlignCenter as IconAlignCenter,
  AlignRight as IconAlignRight,
  Eraser as IconEraser,
} from "lucide-react";

export default function RichTextEditor({ value, onChange, placeholder, disabled }: { value: string; onChange: (html: string) => void; placeholder?: string; disabled?: boolean }) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = editorRef.current; if (!el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  const ensureFocus = () => {
    const el = editorRef.current; if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const inside = !!sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
    if (!inside) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const applyCmd = (cmd: string) => {
    if (disabled) return;
    ensureFocus();
    document.execCommand(cmd);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const toggleBullet = () => {
    if (disabled) return;
    const el = editorRef.current; if (!el) return;
    ensureFocus();
    const sel = window.getSelection();
    const isCollapsed = !sel || sel.rangeCount === 0 || sel.isCollapsed;
    const empty = el.innerText.trim().length === 0;
    if (empty || isCollapsed) {
      document.execCommand('insertHTML', false, '<ul style="list-style: disc; padding-left: 1.25rem;"><li><br></li></ul>');
      const li = el.querySelector('ul li:last-child') as HTMLElement | null;
      if (li) {
        const r = document.createRange(); r.selectNodeContents(li); r.collapse(true);
        const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
      }
      onChange(el.innerHTML);
      return;
    }
    document.execCommand('insertUnorderedList');
    setTimeout(() => onChange(el.innerHTML), 0);
  };

  const toggleOrdered = () => {
    if (disabled) return;
    const el = editorRef.current; if (!el) return;
    ensureFocus();
    const sel = window.getSelection();
    const isCollapsed = !sel || sel.rangeCount === 0 || sel.isCollapsed;
    const empty = el.innerText.trim().length === 0;
    if (empty || isCollapsed) {
      document.execCommand('insertHTML', false, '<ol style="list-style: decimal; padding-left: 1.25rem;"><li><br></li></ol>');
      const li = el.querySelector('ol li:last-child') as HTMLElement | null;
      if (li) { const r = document.createRange(); r.selectNodeContents(li); r.collapse(true); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
      onChange(el.innerHTML);
      return;
    }
    document.execCommand('insertOrderedList');
    setTimeout(() => onChange(el.innerHTML), 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
        <button type="button" aria-label="Đậm" title="Đậm" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('bold')}>
          <IconBold className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Nghiêng" title="Nghiêng" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('italic')}>
          <IconItalic className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Gạch chân" title="Gạch chân" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('underline')}>
          <IconUnderline className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Gạch ngang" title="Gạch ngang" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('strikeThrough')}>
          <IconStrikethrough className="h-4 w-4" />
        </button>
        <span className="mx-1 text-gray-300">|</span>
        <button type="button" aria-label="Danh sách" title="Danh sách" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={toggleBullet}>
          <IconList className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Danh sách số" title="Danh sách số" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={toggleOrdered}>
          <IconListOrdered className="h-4 w-4" />
        </button>
        <span className="mx-1 text-gray-300">|</span>
        <button type="button" aria-label="Căn trái" title="Căn trái" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('justifyLeft')}>
          <IconAlignLeft className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Căn giữa" title="Căn giữa" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('justifyCenter')}>
          <IconAlignCenter className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Căn phải" title="Căn phải" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('justifyRight')}>
          <IconAlignRight className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Xóa định dạng" title="Xóa định dạng" disabled={disabled} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50" onClick={() => applyCmd('removeFormat')}>
          <IconEraser className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder={placeholder || ''}
        className="w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none prose prose-sm dark:prose-invert"
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
}
