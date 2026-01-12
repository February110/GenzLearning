"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import FileViewerPanel from "@/components/common/FileViewerPanel";

export default function FileViewerPage() {
  const params = useSearchParams();
  const target = useMemo(
    () => ({
      key: params.get("key") || undefined,
      url: params.get("url") || undefined,
      submissionId: params.get("id") || params.get("submissionId") || undefined,
      name: params.get("name") || undefined,
    }),
    [params]
  );

  return <FileViewerPanel target={target} />;
}
