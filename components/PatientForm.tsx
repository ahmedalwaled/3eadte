"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions/appointments";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  patient?: {
    id: string;
    name: string;
    phone: string;
    gender: string;
    birth_date: string;
    address: string;
    notes: string;
  };
  submitLabel: string;
};

export default function PatientForm({ action, patient, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="card card-pad space-y-4">
      {patient ? <input type="hidden" name="id" value={patient.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            الاسم الكامل *
          </label>
          <input id="name" name="name" required defaultValue={patient?.name} className="input" placeholder="مثال: أحمد محمد الزهراني" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            رقم الجوال *
          </label>
          <input
            id="phone"
            name="phone"
            required
            defaultValue={patient?.phone}
            dir="ltr"
            inputMode="tel"
            className="input text-left"
            placeholder="05xxxxxxxx"
          />
        </div>
        <div>
          <label className="label" htmlFor="gender">
            الجنس
          </label>
          <select id="gender" name="gender" defaultValue={patient?.gender ?? "male"} className="input">
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="birthDate">
            تاريخ الميلاد
          </label>
          <input id="birthDate" name="birthDate" type="date" defaultValue={patient?.birth_date} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="address">
            المدينة / العنوان
          </label>
          <input id="address" name="address" defaultValue={patient?.address} className="input" placeholder="الرياض" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            ملاحظات إدارية
          </label>
          <textarea id="notes" name="notes" rows={3} defaultValue={patient?.notes} className="input" placeholder="حساسية معروفة، ملاحظات الدفع..." />
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : submitLabel}
        </button>
        <Link href={patient ? `/patients/${patient.id}` : "/patients"} className="btn-ghost">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
