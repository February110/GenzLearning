"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Search, LogOut, User } from "lucide-react";
import ThemeToggler from "./ThemeToggler";
import { useAuth } from "@/context/AuthContext";
import { useLogoutHandler } from "@/utils/logoutHandler";
import { resolveAvatar } from "@/utils/resolveAvatar";

const Header = () => {
  const [stickyMenu, setStickyMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const pathUrl = usePathname();
  const { user } = useAuth();
  const { handleLogout } = useLogoutHandler();

  const menuItems = [
    { title: "Trang chủ", path: "/" },
    { title: "Tính năng", path: "#features" },
    { title: "Tài liệu", path: "#docs" },
    { title: "Tin tức", path: "#news" },
    { title: "Hỗ trợ", path: "#support" },
    { title: "Giới thiệu", path: "#about" },
  ];

  // Sticky effect
  useEffect(() => {
    const handleScroll = () => setStickyMenu(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className={`fixed left-0 top-0 z-[9999] w-full transition-all duration-300 ${
        stickyMenu
          ? "bg-white/90 py-4 shadow-sm backdrop-blur-md dark:bg-gray-900/90"
          : "py-6"
      }`}
    >
      <div className="relative mx-auto flex max-w-screen-xl items-center justify-between px-4 md:px-8">
      {/* MENU TRÁI */}
       <a href="/" className="flex items-center gap-3 cursor-pointer">
          <div className="flex items-center h-12">
            <Image
              src="/images/logo/logo-light.png"
              alt="logo"
              width={150}
              height={60}
              className="dark:hidden object-contain"
            />
            <Image
              src="/images/logo/logo-darkk.png"
              alt="logo"
              width={150}
              height={60}
              className="hidden dark:block object-contain"
            />
          </div>
        </a>
        {/* MENU TRÁI */}
        <ul className="hidden xl:flex ml-12 items-center gap-8">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`text-[15px] font-medium tracking-tight transition-colors ${
                  pathUrl === item.path
                    ? "text-primary"
                    : "text-gray-500 hover:text-primary dark:text-gray-300 dark:hover:text-primary"
                } cursor-pointer`}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>

        {/* MENU PHẢI */}
        <div className="flex items-center gap-5 ml-auto relative">
          <button
            aria-label="Search"
            className="p-2 text-gray-500 hover:text-primary transition dark:text-gray-300 dark:hover:text-primary cursor-pointer"
          >
            <Search className="h-5 w-5" />
          </button>
          <ThemeToggler />

          {!user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-[15px] font-medium text-gray-500 hover:text-primary dark:text-gray-300 dark:hover:text-primary cursor-pointer"
              >
                Đăng nhập
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-white transition hover:bg-primary/90 cursor-pointer"
              >
                Đăng ký
              </Link>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              {/* Avatar + Tên */}
              <button
                onClick={() => setOpenDropdown(!openDropdown)}
                className="flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                {user.avatar ? (
                  <img
                    src={resolveAvatar(user.avatar) || user.avatar}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover cursor-pointer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium cursor-pointer">
                    {user.fullName?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                  {user.fullName}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    openDropdown ? "rotate-180" : ""
                  } cursor-pointer`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown */}
              {openDropdown && (
                <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 py-2 animate-fadeIn">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                    onClick={() => setOpenDropdown(false)}
                  >
                    <User className="h-4 w-4" />
                    Hồ sơ cá nhân
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
