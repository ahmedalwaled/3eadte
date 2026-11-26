"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  label = "نسخ الرابط",
  base,
  className = "btn-ghost !px-3 !py-1.5 text-xs",
}: {
  value: string;
  label?: string;
  base?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const full = base && !value.startsWith("http") ? `${base}${value}` : value;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? "تم النسخ" : label}
    </button>
  );
}
