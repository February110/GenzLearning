"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Save } from "lucide-react";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { resolveAvatar } from "@/utils/resolveAvatar";

type ProfileForm = {
  fullName: string;
  email: string;
  avatar: string | File;
};

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [formData, setFormData] = useState<ProfileForm>({
    fullName: "",
    email: "",
    avatar: "",
  });
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        const data = res.data;

        setFormData({
          fullName: data.fullName || "",
          email: data.email || "",
          avatar: data.avatar || "",
        });

        setPreview(resolveAvatar(data.avatar) || "");
        setUser(data);
      } catch (err) {
        console.error("Lỗi tải hồ sơ:", err);
      }
    };

    fetchProfile();
  }, [setUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    if (name === "avatar" && files && files[0]) {
      const file = files[0];
      setPreview(URL.createObjectURL(file));
      setFormData((p: ProfileForm) => ({ ...p, avatar: file }));
    } else {
      setFormData((p: ProfileForm) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const form = new FormData();
      form.append("FullName", formData.fullName);

      if (formData.avatar && typeof formData.avatar !== "string") {
        form.append("Avatar", formData.avatar);
      }

      const res = await api.put("/auth/profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const normalizedAvatar = res.data.user?.avatar
        ? resolveAvatar(res.data.user.avatar) || res.data.user.avatar
        : undefined;
      const updated = {
        id: res.data.user?.id ?? res.data.user?.Id ?? user?.id ?? "",
        fullName: res.data.user?.fullName ?? user?.fullName ?? "",
        email: res.data.user?.email ?? user?.email ?? "",
        avatar: normalizedAvatar,
        systemRole: user?.systemRole ?? "User",
      };
      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));

      if (updated.avatar && typeof formData.avatar === "string") {
        setPreview(updated.avatar);
      }
      alert("✅ Cập nhật hồ sơ thành công!");
    } catch (error) {
      console.error("Lỗi cập nhật hồ sơ:", error);
      alert("❌ Cập nhật thất bại!");
    } finally {
      setSaving(false);
    }
  };

  if (!formData.email)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Đang tải hồ sơ...
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto mt-28 p-8 bg-white dark:bg-gray-900 rounded-xl shadow-md">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">
        Hồ sơ cá nhân
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ảnh đại diện */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
          <Image
            src={
              preview
                ? preview
                : formData.avatar
                ? typeof formData.avatar === "string"
                  ? resolveAvatar(formData.avatar) || "/images/default-avatar.png"
                  : preview
                : "/images/default-avatar.png"
            }
            alt="avatar"
            width={96}
            height={96}
            unoptimized
            className="rounded-full object-cover border"
          />

            <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition">
              <input
                type="file"
                name="avatar"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
              />
              ✏️
            </label>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Nhấn vào ảnh để thay đổi
          </p>
        </div>

        {/* Họ tên */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Họ và tên
          </label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email (readonly) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            readOnly
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Nút lưu */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
