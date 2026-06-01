import { Suspense } from "react";
import FileViewerPageClient from "./FileViewerPageClient";

export default function FileViewerPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 text-sm text-gray-500">Dang tai trinh xem tep...</div>}>
      <FileViewerPageClient />
    </Suspense>
  );
}
