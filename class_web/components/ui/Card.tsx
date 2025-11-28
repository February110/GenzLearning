"use client";

import React from "react";

export default function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const base = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900";
  return <div className={`${base} ${className}`.trim()}>{children}</div>;
}

