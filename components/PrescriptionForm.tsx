"use client";

import { useActionState, useState } from "react";
import { addPrescription } from "@/lib/actions/visits";
import type { ActionResult } from "@/lib/actions/appointments";
import { PlusIcon } from "./icons";

type Row = { key: number; drug: string; dose: string; frequency: string; duration: string };

const EMPTY: Omit<Row, "key"> = { drug: "", dose: "", frequency: "", duration: "" };

export default function PrescriptionForm({ visitId }: { visitId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addPrescription, null);
  const [rows, setRows] = useState<Row[]>([
    { key: 1, ...EMPTY },
    { key: 2, ...EMPTY },
  ]);

  function update(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="visitId" value={visitId} />

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-2 rounded-xl bg-slate-50 p-2.5 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <label className="label !mb-1 !text-[11px]" htmlFor={`drug-${row.key}`}>
                الدواء {index + 1}
              </label>
              <input
                id={`drug-${row.key}`}
                name="drug"
                value={row.drug}
                onChange={(event) => update(row.key, "drug", event.target.value)}
                className="input !bg-white !py-2 text-[13px]"
                placeholder="باراسيتامول 500 ملغ"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label !mb-1 !text-[11px]" htmlFor={`dose-${row.key}`}>
                الجرعة
              </label>
              <input
                id={`dose-${row.key}`}
                name="dose"
                value={row.dose}
                onChange={(event) => update(row.key, "dose", event.target.value)}
                className="input !bg-white !py-2 text-[13px]"
                placeholder="قرص"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label !mb-1 !text-[11px]" htmlFor={`freq-${row.key}`}>
                التكرار
              </label>
              <input
                id={`freq-${row.key}`}
                name="frequency"
                value={row.frequency}
                onChange={(event) => update(row.key, "frequency", event.target.value)}
                className="input !bg-white !py-2 text-[13px]"
                placeholder="3 مرات يومياً"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label !mb-1 !text-[11px]" htmlFor={`dur-${row.key}`}>
                المدة
              </label>
              <input
                id={`dur-${row.key}`}
                name="duration"
                value={row.duration}
                onChange={(event) => update(row.key, "duration", event.target.value)}
                className="input !bg-white !py-2 text-[13px]"
                placeholder="5 أيام"
              />
            </div>
            <div className="flex items-end sm:col-span-1">
              <button
                type="button"
                onClick={() => setRows((current) => (current.length > 1 ? current.filter((item) => item.key !== row.key) : current))}
                aria-label="حذف السطر"
                className="grid size-9 place-items-center rounded-lg text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 sm:w-full"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, { key: Date.now(), ...EMPTY }])}
        className="btn-ghost !py-2 text-xs"
      >
        <PlusIcon className="size-4" />
        إضافة دواء
      </button>

      <div>
        <label className="label" htmlFor="instructions">
          تعليمات إضافية للمريض
        </label>
        <textarea id="instructions" name="instructions" rows={2} className="input" placeholder="يؤخذ بعد الأكل..." />
      </div>

      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم حفظ الوصفة ضمن الزيارة.</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ الوصفة"}
      </button>
    </form>
  );
}
