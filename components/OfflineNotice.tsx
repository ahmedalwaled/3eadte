"use client";

import { useEffect, useState } from "react";

export default function OfflineNotice() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-[12px] font-semibold text-white">
      أنت غير متصل بالإنترنت — يمكنك متابعة المسودات المحلية وسيتم الحفظ عند عودة الاتصال.
    </div>
  );
}
