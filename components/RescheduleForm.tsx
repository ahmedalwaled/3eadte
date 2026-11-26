"use client";

import { useActionState } from "react";
import { rescheduleAppointment } from "@/lib/actions/appointments";
import type { ActionResult } from "@/lib/actions/appointments";

export default function RescheduleForm({
  id,
  date,
  time,
  duration,
}: {
  id: string;
  date: string;
  time: string;
  duration: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(rescheduleAppointment, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="resched-date">
            التاريخ
          </label>
          <input id="resched-date" name="date" type="date" defaultValue={date} className="input !py-2 text-[13px]" />
        </div>
        <div>
          <label className="label" htmlFor="resched-time">
            الوقت
          </label>
          <input id="resched-time" name="time" type="time" defaultValue={time} step="300" className="input !py-2 text-[13px]" />
        </div>
        <div>
          <label className="label" htmlFor="resched-duration">
            المدة
          </label>
          <select id="resched-duration" name="duration" defaultValue={String(duration)} className="input !py-2 text-[13px]">
            {[10, 15, 20, 30, 45, 60].map((value) => (
              <option key={value} value={value}>
                {value} دقيقة
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error ? <p className="text-xs font-medium text-rose-600">{state.error}</p> : null}
      <button type="submit" className="btn-soft w-full !py-2 text-xs" disabled={pending}>
        {pending ? "جارٍ النقل..." : "نقل الموعد"}
      </button>
    </form>
  );
}
