import api from "./client";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  classroomId?: string;
  assignmentId?: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications() {
  const { data } = await api.get("/notifications");
  return data as { unread: number; items: NotificationItem[] };
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}
