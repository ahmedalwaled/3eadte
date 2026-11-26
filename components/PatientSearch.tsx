"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { SearchIcon } from "@/components/icons";

export default function PatientSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const typed = input.current?.value ?? "";
    if (typed.trim() !== initial.trim()) update(typed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      startTransition(() => {
        router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
      });
    }, 250);
  }

  return (
    <div className="relative mb-4">
      <SearchIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={input}
        type="search"
        defaultValue={initial}
        onChange={(event) => update(event.target.value)}
        className="input pr-9 pl-9"
        placeholder="ابحث بالاسم أو رقم الجوال أو رقم الملف"
        aria-label="بحث عن مريض"
        autoComplete="off"
      />
      {pending ? (
        <span
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700"
        />
      ) : null}
    </div>
  );
}
