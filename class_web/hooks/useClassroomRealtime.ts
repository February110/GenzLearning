"use client";

import { useEffect, useRef } from "react";
import { getSignalR } from "@/lib/signalr";

export type ClassroomRealtimeHandlers = {
  onMemberJoined?: (payload: any) => void;
  onAnnouncementAdded?: (a: any) => void;
  onAnnouncementUpdated?: (a: any) => void;
  onAnnouncementDeleted?: (a: any) => void;
  onAnnouncementCommentAdded?: (c: any) => void;
  onAssignmentCreated?: (a: any) => void;
  onAssignmentUpdated?: (a: any) => void;
  onAssignmentDeleted?: (a: any) => void;
};

export default function useClassroomRealtime(classroomId?: string, handlers: ClassroomRealtimeHandlers = {}) {
  const groupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!classroomId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    const hubBase = base.replace(/\/api$/, "");
    const conn = getSignalR(hubBase, "/hubs/classroom");
    const group = String(classroomId);
    groupRef.current = group;

    const ensureJoin = async () => {
      try {
        await conn.start().catch(() => {});
        await conn.invoke("Join", group).catch(() => {});
      } catch {}
    };

    const wrap = (fn?: (x: any) => void) => (x: any) => {
      try { fn && fn(x); } catch {}
    };

    // Register handlers
    const hMember = wrap(handlers.onMemberJoined);
    const hAnn = wrap(handlers.onAnnouncementAdded);
    const hAUd = wrap(handlers.onAnnouncementUpdated);
    const hADl = wrap(handlers.onAnnouncementDeleted);
    const hACmt = wrap(handlers.onAnnouncementCommentAdded);
    const hAC = wrap(handlers.onAssignmentCreated);
    const hAU = wrap(handlers.onAssignmentUpdated);
    const hAD = wrap(handlers.onAssignmentDeleted);

    try { (conn as any).off?.("MemberJoined", hMember as any); } catch {}
    try { (conn as any).off?.("AnnouncementAdded", hAnn as any); } catch {}
    try { (conn as any).off?.("AnnouncementUpdated", hAUd as any); } catch {}
    try { (conn as any).off?.("AnnouncementDeleted", hADl as any); } catch {}
    try { (conn as any).off?.("AnnouncementCommentAdded", hACmt as any); } catch {}
    try { (conn as any).off?.("AssignmentCreated", hAC as any); } catch {}
    try { (conn as any).off?.("AssignmentUpdated", hAU as any); } catch {}
    try { (conn as any).off?.("AssignmentDeleted", hAD as any); } catch {}

    conn.on("MemberJoined", (p: any) => {
      if (String(p?.classroomId) !== group) return; hMember(p);
    });
    conn.on("AnnouncementAdded", (a: any) => {
      if (String(a?.classroomId) !== group) return; hAnn(a);
    });
    conn.on("AnnouncementUpdated", (a: any) => {
      if (String(a?.classroomId) !== group) return; hAUd(a);
    });
    conn.on("AnnouncementDeleted", (a: any) => {
      if (String(a?.classroomId) !== group) return; hADl(a);
    });
    conn.on("AnnouncementCommentAdded", (c: any) => {
      if (String(c?.classroomId) !== group) return; hACmt(c);
    });
    conn.on("AssignmentCreated", (a: any) => {
      if (String(a?.classroomId) !== group) return; hAC(a);
    });
    conn.on("AssignmentUpdated", (a: any) => {
      if (String(a?.classroomId) !== group) return; hAU(a);
    });
    conn.on("AssignmentDeleted", (a: any) => { hAD(a); });

    ensureJoin();
    (conn as any).onreconnected?.(() => ensureJoin());

    return () => {
      try { (conn as any).off?.("MemberJoined", hMember as any); } catch {}
      try { (conn as any).off?.("AnnouncementAdded", hAnn as any); } catch {}
      try { (conn as any).off?.("AnnouncementUpdated", hAUd as any); } catch {}
      try { (conn as any).off?.("AnnouncementDeleted", hADl as any); } catch {}
      try { (conn as any).off?.("AnnouncementCommentAdded", hACmt as any); } catch {}
      try { (conn as any).off?.("AssignmentCreated", hAC as any); } catch {}
      try { (conn as any).off?.("AssignmentUpdated", hAU as any); } catch {}
      try { (conn as any).off?.("AssignmentDeleted", hAD as any); } catch {}
      const g = groupRef.current; if (g) conn.invoke("Leave", g).catch(() => {});
    };
  }, [classroomId, handlers.onMemberJoined, handlers.onAnnouncementAdded, handlers.onAnnouncementUpdated, handlers.onAnnouncementDeleted, handlers.onAnnouncementCommentAdded, handlers.onAssignmentCreated, handlers.onAssignmentUpdated, handlers.onAssignmentDeleted]);
}
