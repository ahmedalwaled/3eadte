"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";

const DEMO = [
  { role: "طبيب", email: "doctor@clinic.demo", password: "doctor123" },
  { role: "سكرتيرة", email: "secretary@clinic.demo", password: "secret123" },
  { role: "مدير المنصة", email: "admin@platform.demo", password: "admin123" },
];

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState | null, FormData>(loginAction, null);

  return (
    <div className="w-full max-w-md">
      <div className="card card-pad">
        <h1 className="text-xl font-bold text-slate-900">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-slate-600">أدخل بيانات حسابك للمتابعة إلى لوحة العيادة.</p>

        <form action={action} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" placeholder="name@clinic.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              كلمة المرور
            </label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
          </div>

          {state?.error ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
              {state.error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>

      <div className="card card-pad mt-4">
        <p className="section-title mb-2 text-sm">حسابات تجريبية</p>
        <ul className="space-y-2 text-[13px] text-slate-700">
          {DEMO.map((item) => (
            <li key={item.email} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-slate-100 px-3 py-2">
              <span className="font-semibold text-slate-900">{item.role}</span>
              <span dir="ltr" className="font-mono text-[12px] font-semibold text-slate-900">
                {item.email} / {item.password}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
