"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

type Hit = { kind: string; id: string; title: string; sub: string; href: string };

const KIND_LABEL: Record<string, string> = {
  patient: "مريض",
  appointment: "موعد",
  visit: "زيارة",
  prescription: "وصفة",
  attachment: "ملف",
  payment: "دفعة",
  expense: "مصروف",
};

const KIND_STYLE: Record<string, string> = {
  patient: "bg-brand-50 text-brand-900 ring-brand-300",
  appointment: "bg-sky-50 text-sky-900 ring-sky-300",
  visit: "bg-violet-50 text-violet-900 ring-violet-300",
  prescription: "bg-emerald-50 text-emerald-900 ring-emerald-300",
  attachment: "bg-slate-100 text-slate-800 ring-slate-300",
  payment: "bg-amber-50 text-amber-900 ring-amber-300",
  expense: "bg-rose-50 text-rose-900 ring-rose-300",
};

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [ms, setMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      abortRef.current?.abort();
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await res.json()) as { hits?: Hit[]; ms?: number };
        setHits(data.hits ?? []);
        setMs(data.ms ?? 0);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative" role="search">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="ابحث في كل شيء: مريض، دواء، موعد، زيارة، مصروف، ملف…"
          aria-label="بحث شامل"
          className="input !py-3 !pr-11 !text-sm"
        />
        {loading ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-600">…</span>
        ) : null}
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-[11px] font-semibold text-slate-600" aria-live="polite">
            {hits.length === 0 ? "لا نتائج مطابقة" : `${hits.length} نتيجة`} · {ms} م.ث
          </p>
          {hits.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-600">جرّب جزءاً من الاسم أو رقم الجوال أو الدواء.</p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  >
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                        KIND_STYLE[hit.kind] ?? "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}
                    >
                      {KIND_LABEL[hit.kind] ?? hit.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">{hit.title}</span>
                      <span className="block truncate text-[11px] text-slate-600">{hit.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
