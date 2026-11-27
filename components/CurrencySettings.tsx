"use client";

import { useActionState } from "react";
import { addCurrency, deleteCurrency } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/appointments";
import { CURRENCY_OPTIONS, currencyLabel, money, type ClinicCurrency } from "@/lib/format";

export default function CurrencySettings({ base, currencies }: { base: string; currencies: ClinicCurrency[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addCurrency, null);
  const available = CURRENCY_OPTIONS.filter((option) => option.code !== base && !currencies.some((item) => item.code === option.code));

  return (
    <section className="card">
      <h2 className="section-title">العملات</h2>
      <p className="mt-1 text-xs text-slate-700">
        العملة الأساسية للعيادة: <span className="font-semibold text-slate-700">{currencyLabel(base)}</span>. أضف عملات أخرى مع سعر صرفها
        مقابل العملة الأساسية، وسيتم تحويل كل المبالغ إلى العملة الأساسية في التقارير.
      </p>

      {currencies.length ? (
        <ul className="mt-4 space-y-2">
          {currencies.map((item) => (
            <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <span className="badge bg-white text-slate-700 ring-slate-200">{item.code}</span>
              <span className="text-sm font-bold text-slate-900">
                {currencyLabel(item.code)} — 1 {item.code} = {money(item.rate, base)}
              </span>
              <form action={deleteCurrency} className="ms-auto">
                <input type="hidden" name="code" value={item.code} />
                <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
                  حذف
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
          لا توجد عملات إضافية بعد.
        </p>
      )}

      {available.length ? (
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="currency-code">
              إضافة عملة
            </label>
            <select id="currency-code" name="code" className="input" defaultValue={available[0].code} required>
              {available.map((option) => (
                <option key={option.code} value={option.code}>
                  {currencyLabel(option.code)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="currency-rate">
              سعر الصرف مقابل {base}
            </label>
            <input id="currency-rate" name="rate" type="number" min="0.000001" step="any" required className="input" placeholder={`1 = ? ${base}`} />
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "جارٍ الحفظ..." : "إضافة"}
          </button>
        </form>
      ) : null}

      {state?.error ? <p className="mt-2 text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm font-medium text-emerald-600">تم حفظ العملة.</p> : null}
    </section>
  );
}
