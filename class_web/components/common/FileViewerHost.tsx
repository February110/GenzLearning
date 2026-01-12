"use client";

import { useEffect, useState } from "react";
import FileViewerPanel from "@/components/common/FileViewerPanel";
import { FileViewerTarget } from "@/utils/fileViewer";

export default function FileViewerHost() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<FileViewerTarget | null>(null);

  useEffect(() => {
    const w = window as any;
    w.__fileViewerHostReady = true;
    if (w.__fileViewerPendingTarget) {
      setTarget(w.__fileViewerPendingTarget);
      setOpen(true);
      delete w.__fileViewerPendingTarget;
    }
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<FileViewerTarget>).detail || {};
      setTarget(detail);
      setOpen(true);
    };
    window.addEventListener("file-viewer:open", handler as EventListener);
    return () => {
      delete w.__fileViewerHostReady;
      window.removeEventListener("file-viewer:open", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-xl">
        <FileViewerPanel target={target} onClose={close} className="p-4 md:p-6" />
      </div>
    </div>
  );
}
