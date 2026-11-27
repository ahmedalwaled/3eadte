"use client";

import { useActionState } from "react";
import { createClinic } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/appointments";

export default function ClinicForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createClinic, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nc-name">
            اسم العيادة
          </label>
          <input id="nc-name" name="name" required className="input" placeholder="عيادة النور الطبية" />
        </div>
        <div>
          <label className="label" htmlFor="nc-phone">
            الهاتف
          </label>
          <input id="nc-phone" name="phone" className="input" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="nc-currency">
            العملة
          </label>
          <select id="nc-currency" name="currency" className="input" defaultValue="SYP">
            <option value="SYP">ليرة سورية</option>
            <option value="AED">درهم إماراتي</option>
            <option value="QAR">ريال قطري</option>
            <option value="KWD">دينار كويتي</option>
            <option value="JOD">دينار أردني</option>
            <option value="EGP">جنيه مصري</option>
            <option value="USD">دولار أمريكي</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nc-address">
            العنوان
          </label>
          <input id="nc-address" name="address" className="input" />
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold text-slate-500">حساب الطبيب المسؤول (المالك)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="nc-doctor">
              اسم الطبيب
            </label>
            <input id="nc-doctor" name="doctorName" required className="input !bg-white" placeholder="د. سارة العتيبي" />
          </div>
          <div>
            <label className="label" htmlFor="nc-specialty">
              التخصص
            </label>
            <input id="nc-specialty" name="specialty" className="input !bg-white" placeholder="طب الأسرة" />
          </div>
          <div>
            <label className="label" htmlFor="nc-email">
              البريد الإلكتروني
            </label>
            <input id="nc-email" name="doctorEmail" type="email" required className="input !bg-white" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="nc-password">
              كلمة المرور
            </label>
            <input id="nc-password" name="doctorPassword" type="password" minLength={6} required className="input !bg-white" />
          </div>
        </div>
      </div>

      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم إنشاء العيادة وحساب الطبيب.</p> : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "جارٍ الإنشاء..." : "إنشاء العيادة"}
      </button>
    </form>
  );
}
