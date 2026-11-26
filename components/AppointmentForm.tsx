"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createAppointment } from "@/lib/actions/appointments";
import type { ActionResult } from "@/lib/actions/appointments";
import { todayISO } from "@/lib/format";

type PatientOption = { id: string; name: string; code: string; phone: string };
type DoctorOption = { id: string; name: string; specialty: string };

export default function AppointmentForm({
  patients,
  doctors,
  defaultDate,
  defaultPatientId,
  defaultTime,
}: {
  patients: PatientOption[];
  doctors: DoctorOption[];
  defaultDate: string;
  defaultPatientId?: string;
  defaultTime?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createAppointment, null);

  return (
    <form action={action} className="card card-pad space-y-4">
      <div>
        <label className="label" htmlFor="patientId">
          المريض المسجل
        </label>
        <select id="patientId" name="patientId" className="input" defaultValue={defaultPatientId ?? ""}>
          <option value="">— مريض جديد (أدخل البيانات أدناه) —</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name} — {patient.code} — {patient.phone}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
        <p className="text-[11px] font-semibold text-slate-500 sm:col-span-2">أو سجّل مريضاً جديداً أثناء الحجز</p>
        <div>
          <label className="label" htmlFor="newPatientName">
            اسم المريض
          </label>
          <input id="newPatientName" name="newPatientName" className="input !bg-white" placeholder="الاسم الكامل" />
        </div>
        <div>
          <label className="label" htmlFor="newPatientPhone">
            رقم الجوال
          </label>
          <input id="newPatientPhone" name="newPatientPhone" className="input !bg-white" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="date">
            التاريخ
          </label>
          <input id="date" name="date" type="date" required defaultValue={defaultDate || todayISO()} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="time">
            الوقت
          </label>
          <input id="time" name="time" type="time" required defaultValue={defaultTime ?? "09:00"} step="300" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="duration">
            المدة (دقيقة)
          </label>
          <select id="duration" name="duration" className="input" defaultValue="20">
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="45">45</option>
            <option value="60">60</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="doctorId">
            الطبيب
          </label>
          <select id="doctorId" name="doctorId" className="input" defaultValue={doctors[0]?.id ?? ""}>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} {doctor.specialty ? `— ${doctor.specialty}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reason">
            سبب الزيارة
          </label>
          <input id="reason" name="reason" className="input" placeholder="متابعة، فحص، استشارة..." />
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "جارٍ الحجز..." : "تأكيد الحجز"}
        </button>
        <Link href="/appointments" className="btn-ghost">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
