"use client";

import React from "react";

type Variant = "primary" | "secondary" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export default function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed";
  const byVariant: Record<Variant, string> = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    secondary: "bg-sky-600 hover:bg-sky-700 text-white",
    outline: "border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-gray-100",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  const bySize: Record<Size, string> = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-5 py-2.5",
  };
  const cls = `${base} ${byVariant[variant]} ${bySize[size]} ${className}`.trim();
  return (
    <button className={cls} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

