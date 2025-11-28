"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, NotificationItem } from "@/api/notifications";

class SilentLogger implements signalR.ILogger {
  log(): void {
    // swallow SignalR internal logs to avoid noisy console output
  }
}

export default function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications();
      setItems(data.items);
      setUnread(data.unread);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    const hubUrl = `${base.replace(/\/api$/, "")}/hubs/notifications`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => (typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""),
      })
      .withAutomaticReconnect()
      .configureLogging(new SilentLogger())
      .build();

    connectionRef.current = connection;
    let disposed = false;

    connection.on("NotificationReceived", (payload: any) => {
      setItems((prev) => [payload, ...prev].slice(0, 20));
      setUnread((prev) => prev + 1);
    });

    const start = async () => {
      if (disposed) return;
      try {
        await connection.start();
      } catch {
        if (!disposed) {
          retryRef.current = setTimeout(start, 5000);
        }
      }
    };
    start();
    return () => {
      disposed = true;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      connection.stop().catch(() => {});
      connection.off("NotificationReceived");
      connectionRef.current = null;
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }, []);

  return { items, unread, loading, reload: load, markRead, markAllRead };
}
