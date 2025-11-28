"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/api/client";
import { signIn } from "next-auth/react";

export default function Register() {
  const router = useRouter();
  const [data, setData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  // 🟢 Đăng ký tài khoản local (email + password)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/register", data);
      toast.success("Đăng ký thành công!");
      setTimeout(() => router.replace("/auth/login"), 800);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  // 🟢 Đăng ký / đăng nhập bằng Google hoặc Facebook qua NextAuth
  const handleOAuthRegister = async (provider: "google" | "facebook") => {
    try {
      await signIn(provider, { callbackUrl: "/auth/callback" });
    } catch (err) {
      console.error(err);
      toast.error("Không thể đăng ký bằng " + provider);
    }
  };

  return (
    <>
      <section className="pb-12 pt-32 lg:pb-24 lg:pt-40 xl:pb-32 xl:pt-48 bg-[#F9FAFB] dark:bg-black">
        <div className="mx-auto max-w-[900px] px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="rounded-lg bg-white p-10 shadow-solid-8 dark:bg-black dark:border dark:border-strokedark"
          >
            <h2 className="mb-10 text-center text-3xl font-semibold text-black dark:text-white">
              Tạo tài khoản của bạn
            </h2>

            {/* Social Register */}
            <div className="flex flex-col sm:flex-row sm:gap-8 gap-6 mb-10 justify-center">
              <button
                type="button"
                onClick={() => handleOAuthRegister("google")}
                className="flex w-full sm:w-1/2 items-center justify-center rounded-md border border-stroke bg-[#f9f9f9] px-6 py-3 text-base text-gray-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-transparent dark:bg-[#2C303B] dark:text-gray-300 cursor-pointer"
              >
                <img
                  src="/images/icon/icon-google.svg"
                  alt="Google"
                  className="mr-2 h-5 w-5"
                />
                Đăng ký bằng Google
              </button>

              <button
                type="button"
                onClick={() => handleOAuthRegister("facebook")}
                className="flex w-full sm:w-1/2 items-center justify-center rounded-md border border-stroke bg-[#f9f9f9] px-6 py-3 text-base text-gray-700 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-transparent dark:bg-[#2C303B] dark:text-gray-300 cursor-pointer"
              >
                <img
                  src="/images/icon/icon-facebook.svg"
                  alt="Facebook"
                  className="mr-2 h-5 w-5"
                />
                Đăng ký bằng Facebook
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-16">
              <span className="h-px w-full bg-stroke dark:bg-strokedark"></span>
              <span className="absolute bg-white px-4 text-gray-400 dark:bg-black dark:text-gray-400">
                HOẶC
              </span>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit}>
              <div className="mb-8 flex flex-col lg:flex-row lg:gap-14 gap-6">
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={data.fullName}
                  onChange={(e) =>
                    setData({ ...data, fullName: e.target.value })
                  }
                  required
                  className="w-full border-b border-stroke bg-transparent pb-3.5 text-gray-800 focus:border-primary focus:outline-none dark:border-strokedark dark:text-white lg:w-1/2"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  required
                  className="w-full border-b border-stroke bg-transparent pb-3.5 text-gray-800 focus:border-primary focus:outline-none dark:border-strokedark dark:text-white lg:w-1/2"
                />
              </div>

              <div className="mb-10">
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={data.password}
                  onChange={(e) =>
                    setData({ ...data, password: e.target.value })
                  }
                  required
                  className="w-full border-b border-stroke bg-transparent pb-3.5 text-gray-800 focus:border-primary focus:outline-none dark:border-strokedark dark:text-white"
                />
              </div>

              {/* Nút đăng ký */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={loading}
                  aria-label="register"
                  className={`inline-flex items-center gap-2.5 rounded-full px-8 py-3 font-medium text-white duration-300 ease-in-out ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer"
                  }`}
                >
                  {loading ? "Đang xử lý..." : "Tạo tài khoản"}
                  <svg
                    className="fill-white"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.4767 6.16664L6.00668 1.69664L7.18501 0.518311L13.6667 6.99998L7.18501 13.4816L6.00668 12.3033L10.4767 7.83331H0.333344V6.16664H10.4767Z" />
                  </svg>
                </button>
              </div>

              {/* Đã có tài khoản */}
              <div className="mt-12 border-t border-stroke py-5 text-center dark:border-strokedark">
                <p className="text-gray-600 dark:text-gray-300">
                  Đã có tài khoản?{" "}
                  <Link
                    href="/auth/login"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Đăng nhập ngay
                  </Link>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </section>
    </>
  );
}
