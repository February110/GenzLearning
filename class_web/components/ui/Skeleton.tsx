"use client";

import React from "react";

export default function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-zinc-800 ${className}`.trim()} />;
}

