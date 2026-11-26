"use client";

import { PrintIcon } from "./icons";

export default function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      <PrintIcon className="size-4" />
      {label}
    </button>
  );
}
