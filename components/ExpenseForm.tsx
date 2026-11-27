"use client";

import { useActionState } from "react";
import { addExpense } from "@/lib/actions/finance";
import type { ActionResult } from "@/lib/actions/appointments";
import { todayISO, type ClinicCurrency } from "@/lib/format";
import AmountCurrencyFields from "@/components/AmountCurrencyFields";

export default function ExpenseForm({ baseCurrency = "SYP", currencies = [] }: { baseCurrency?: string; currencies?: ClinicCurrency[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addExpense, null);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="expense-title">
          وصف المصروف
        </label>
        <input id="expense-title" name="title" required className="input" placeholder="إيجار، مستلزمات، صيانة..." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AmountCurrencyFields idPrefix="expense" base={baseCurrency} currencies={currencies} label="المبلغ" />
        <div>
          <label className="label" htmlFor="expense-date">
            التاريخ
          </label>
          <input id="expense-date" name="spentAt" type="date" defaultValue={todayISO()} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="expense-category">
          التصنيف
        </label>
        <select id="expense-category" name="category" className="input" defaultValue="general">
          <option value="rent">إيجار</option>
          <option value="supplies">مستلزمات</option>
          <option value="utilities">فواتير وخدمات</option>
          <option value="salaries">رواتب</option>
          <option value="maintenance">صيانة</option>
          <option value="marketing">تسويق</option>
          <option value="general">أخرى</option>
        </select>
      </div>
      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم تسجيل المصروف.</p> : null}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "جارٍ الحفظ..." : "تسجيل المصروف"}
      </button>
    </form>
  );
}
