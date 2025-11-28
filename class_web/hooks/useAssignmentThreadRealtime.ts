"use client";

import { useEffect, useRef } from "react";
import { getSignalR } from "@/lib/signalr";

export default function useAssignmentThreadRealtime(
  assignmentId?: string,
  studentId?: string,
  onCommentAdded?: (c: any) => void
) {
  const groupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!assignmentId || !studentId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    const hubBase = base.replace(/\/api$/, "");
    const conn = getSignalR(hubBase, "/hubs/classroom");
    const group = `${String(assignmentId).toLowerCase()}:${String(studentId).toLowerCase()}`;
    groupRef.current = group;

    const ensure = async () => {
      try { await conn.start().catch(() => {}); } catch {}
      try { await conn.invoke("Join", group).catch(() => {}); } catch {}
    };

    const handler = (c: any) => { try { onCommentAdded && onCommentAdded(c); } catch {} };
    try { (conn as any).off?.("CommentAdded", handler as any); } catch {}
    conn.on("CommentAdded", handler);

    ensure();
    (conn as any).onreconnected?.(() => ensure());

    return () => {
      try { (conn as any).off?.("CommentAdded", handler as any); } catch {}
      const g = groupRef.current; if (g) conn.invoke("Leave", g).catch(() => {});
    };
  }, [assignmentId, studentId, onCommentAdded]);
}

