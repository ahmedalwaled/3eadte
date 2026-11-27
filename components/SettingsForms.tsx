"use client";

import { useActionState } from "react";
import { addStaff, updateStaff, updateClinic } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/appointments";
import { CURRENCY_OPTIONS } from "@/lib/format";

const CURRENCIES = CURRENCY_OPTIONS.map((option) => [option.code, option.label] as const);

export function ClinicForm({ clinic }: { clinic: { name: string; phone: string; address: string; currency: string } }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateClinic, null);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="clinic-name">
          اسم العيادة
        </label>
        <input id="clinic-name" name="name" defaultValue={clinic.name} className="input" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clinic-phone">
            الهاتف
          </label>
          <input id="clinic-phone" name="phone" defaultValue={clinic.phone} className="input" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="clinic-currency">
            العملة
          </label>
          <select id="clinic-currency" name="currency" defaultValue={clinic.currency} className="input">
            {CURRENCIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="clinic-address">
          العنوان
        </label>
        <input id="clinic-address" name="address" defaultValue={clinic.address} className="input" />
      </div>
      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم الحفظ.</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ بيانات العيادة"}
      </button>
    </form>
  );
}

export function StaffEditForm({ member }: { member: { id: string; name: string; email: string; role: string; specialty: string } }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateStaff, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={member.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`name-${member.id}`}>
            الاسم
          </label>
          <input id={`name-${member.id}`} name="name" required defaultValue={member.name} className="input" />
        </div>
        {member.role === "doctor" ? (
          <div>
            <label className="label" htmlFor={`specialty-${member.id}`}>
              التخصص
            </label>
            <input id={`specialty-${member.id}`} name="specialty" defaultValue={member.specialty} className="input" placeholder="طب الأسرة، أطفال..." />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`password-${member.id}`}>
            كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)
          </label>
          <input id={`password-${member.id}`} name="password" type="password" minLength={6} className="input" dir="ltr" placeholder="6 أحرف على الأقل" />
        </div>
      </div>
      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم حفظ التعديلات.</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
      </button>
    </form>
  );
}

export function StaffForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addStaff, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="staff-name">
            الاسم
          </label>
          <input id="staff-name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="staff-role">
            الصلاحية
          </label>
          <select id="staff-role" name="role" className="input" defaultValue="secretary">
            <option value="secretary">سكرتيرة</option>
            <option value="doctor">طبيب</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="staff-email">
            البريد الإلكتروني
          </label>
          <input id="staff-email" name="email" type="email" required className="input" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="staff-password">
            كلمة المرور
          </label>
          <input id="staff-password" name="password" type="password" minLength={6} required className="input" placeholder="6 أحرف على الأقل" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="staff-specialty">
            التخصص (للأطباء فقط)
          </label>
          <input id="staff-specialty" name="specialty" className="input" placeholder="طب الأسرة، أطفال..." />
        </div>
      </div>
      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تمت إضافة المستخدم.</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "جارٍ الإضافة..." : "إضافة مستخدم"}
      </button>
    </form>
  );
}
