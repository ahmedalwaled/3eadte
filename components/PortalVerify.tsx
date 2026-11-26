"use client";

import { useActionState } from "react";
import { verifyPortal, type PortalState } from "@/lib/actions/portal";

export default function PortalVerify({ token, clinicName }: { token: string; clinicName: string }) {
  const [state, action, pending] = useActionState<PortalState | null, FormData>(verifyPortal, null);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="card card-pad">
        <p className="text-xs font-semibold text-brand-700">{clinicName}</p>
        <h1 className="mt-1 text-lg font-extrabold text-slate-900">بوابة المريض</h1>
        <p className="mt-1 text-[13px] text-slate-500">لحماية خصوصية ملفك، أدخل رقم الجوال المسجل في العيادة للتحقق من هويتك.</p>

        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="portal-phone">
              رقم الجوال
            </label>
            <input
              id="portal-phone"
              name="phone"
              required
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              className="input text-left"
              placeholder="05xxxxxxxx"
            />
          </div>
          {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "جارٍ التحقق..." : "دخول البوابة"}
          </button>
        </form>
        <p className="mt-3 text-[11px] text-slate-400">لا تشارك هذا الرابط مع أي شخص آخر.</p>
      </div>
    </div>
  );
}
