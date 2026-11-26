"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useActionState } from "react";
import type { ActionResult } from "@/lib/actions/appointments";
import { nowTime, todayISO } from "@/lib/format";

type VisitValues = {
  id?: string;
  visit_date?: string;
  complaint?: string;
  vitals?: string;
  exam?: string;
  diagnosis?: string;
  treatment?: string;
  recommendations?: string;
  follow_up?: string;
  fee?: number;
  discount?: number;
  shared?: number;
};

export default function VisitForm({
  action,
  patientId,
  patientName,
  appointmentId,
  values,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  values?: VisitValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftKey = `visit-draft:${values?.id ?? appointmentId ?? patientId}`;

  useEffect(() => {
    if (values) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw || !formRef.current) return;
    try {
      const draft = JSON.parse(raw) as Record<string, string>;
      Object.entries(draft).forEach(([name, value]) => {
        const field = formRef.current?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
      });
      setDraftSaved(true);
    } catch {
      /* ignore broken draft */
    }
  }, [draftKey, values]);

  function saveDraft() {
    if (values || !formRef.current) return;
    const data = new FormData(formRef.current);
    const draft: Record<string, string> = {};
    data.forEach((value, key) => {
      if (typeof value === "string") draft[key] = value;
    });
    localStorage.setItem(draftKey, JSON.stringify(draft));
    setDraftSaved(true);
  }

  useEffect(() => {
    if (state?.ok) localStorage.removeItem(draftKey);
  }, [state?.ok, draftKey]);

  const visitDate = values?.visit_date?.slice(0, 10) ?? todayISO();
  const visitTime = values?.visit_date?.slice(11, 16) ?? nowTime();

  return (
    <form ref={formRef} action={formAction} onChange={saveDraft} className="space-y-4">
      <input type="hidden" name="patientId" value={patientId} />
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">بيانات الزيارة — {patientName}</h2>
          {draftSaved && !values ? <span className="badge bg-amber-50 text-amber-700 ring-amber-200">مسودة محفوظة على هذا الجهاز</span> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {values?.id ? (
            <div>
              <label className="label" htmlFor="visitDate">
                التاريخ
              </label>
              <input id="visitDate" name="visitDate" type="date" defaultValue={visitDate} className="input" readOnly />
            </div>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="visitDate">
                  تاريخ الزيارة
                </label>
                <input id="visitDate" name="visitDate" type="date" defaultValue={visitDate} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="visitTime">
                  الوقت
                </label>
                <input id="visitTime" name="visitTime" type="time" defaultValue={visitTime} className="input" />
              </div>
            </>
          )}
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="complaint">
              الشكوى الرئيسية *
            </label>
            <textarea id="complaint" name="complaint" rows={2} required defaultValue={values?.complaint} className="input" placeholder="ألم البطن منذ يومين..." />
          </div>
          <div>
            <label className="label" htmlFor="vitals">
              العلامات الحيوية
            </label>
            <input
              id="vitals"
              name="vitals"
              defaultValue={values?.vitals}
              className="input"
              placeholder="الحرارة: 37.2 · الضغط: 120/80 · النبض: 78 · الوزن: 70 كغ"
            />
          </div>
          <div>
            <label className="label" htmlFor="exam">
              الفحص السريري
            </label>
            <textarea id="exam" name="exam" rows={2} defaultValue={values?.exam} className="input" placeholder="نتائج الفحص..." />
          </div>
          <div>
            <label className="label" htmlFor="diagnosis">
              التشخيص *
            </label>
            <input id="diagnosis" name="diagnosis" required defaultValue={values?.diagnosis} className="input" placeholder="التشخيص النهائي" />
          </div>
          <div>
            <label className="label" htmlFor="treatment">
              العلاج الموصوف
            </label>
            <textarea id="treatment" name="treatment" rows={2} defaultValue={values?.treatment} className="input" placeholder="الأدوية والجرعات..." />
          </div>
          <div>
            <label className="label" htmlFor="recommendations">
              التوصيات
            </label>
            <textarea
              id="recommendations"
              name="recommendations"
              rows={2}
              defaultValue={values?.recommendations}
              className="input"
              placeholder="نصائح ومتابعة..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="followUp">
                موعد المراجعة
              </label>
              <input id="followUp" name="followUp" type="date" defaultValue={values?.follow_up} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="fee">
                قيمة الكشف
              </label>
              <input id="fee" name="fee" type="number" min="0" step="0.01" defaultValue={values?.fee ?? 150} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="discount">
                خصم
              </label>
              <input id="discount" name="discount" type="number" min="0" step="0.01" defaultValue={values?.discount ?? 0} className="input" />
            </div>
          </div>
          {values?.id ? (
            <label className="flex items-center gap-2 text-[13px] text-slate-600">
              <input type="checkbox" name="shared" defaultChecked={Boolean(values.shared)} className="size-4 rounded border-slate-300" />
              مشاركة الزيارة في بوابة المريض
            </label>
          ) : null}
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">تم الحفظ.</p> : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : submitLabel}
        </button>
        <Link href={cancelHref} className="btn-ghost">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
