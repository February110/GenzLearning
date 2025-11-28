"use client";

import React from "react";

interface ClassroomSettingsSheetProps {
  open: boolean;
  inviteVisible: boolean;
  changingBanner: boolean;
  updatingInviteVisibility: boolean;
  onClose: () => void;
  onChangeBanner: () => void;
  onToggleInvite: () => void;
}

export default function ClassroomSettingsSheet({
  open,
  inviteVisible,
  changingBanner,
  updatingInviteVisibility,
  onClose,
  onChangeBanner,
  onToggleInvite,
}: ClassroomSettingsSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-6 top-32 z-50 w-full max-w-xs rounded-2xl border border-gray-200 bg-white px-2 py-2 dark:border-gray-800 dark:bg-zinc-900 text-sm text-gray-900 dark:text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold">Cài đặt lớp</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Đóng
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <button
            type="button"
            onClick={onChangeBanner}
            disabled={changingBanner}
            className="w-full rounded-lg border border-indigo-600 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition disabled:opacity-60 disabled:cursor-wait"
          >
            {changingBanner ? "Đang đổi banner..." : "Đổi banner"}
          </button>
          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Hiển thị mã mời</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cho phép học sinh xem mã tham gia</p>
              </div>
              <button
                type="button"
                onClick={onToggleInvite}
                disabled={updatingInviteVisibility}
                className="rounded-full border border-gray-300 bg-white px-4 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-zinc-900 dark:text-white disabled:opacity-60 disabled:cursor-wait min-w-[120px] text-center"
              >
                {updatingInviteVisibility ? "Đang cập nhật..." : inviteVisible ? "Đang hiển thị" : "Đã ẩn"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
