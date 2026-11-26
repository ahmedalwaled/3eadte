"use client";

import { useActionState } from "react";
import { addPayment } from "@/lib/actions/finance";
import type { ActionResult } from "@/lib/actions/appointments";
import { todayISO, type ClinicCurrency } from "@/lib/format";
import AmountCurrencyFields from "@/components/AmountCurrencyFields";

export default function PaymentForm({
  patientId,
  visitId,
  patients,
  suggested,
  backTo,
  baseCurrency = "SAR",
  currencies = [],
}: {
  patientId?: string;
  visitId?: string;
  patients?: { id: string; name: string }[];
  suggested?: number;
  backTo?: string;
  baseCurrency?: string;
  currencies?: ClinicCurrency[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addPayment, null);

  return (
    <form action={action} className="space-y-3">
      {patientId ? <input type="hidden" name="patientId" value={patientId} /> : null}
      {visitId ? <input type="hidden" name="visitId" value={visitId} /> : null}
      {backTo ? <input type="hidden" name="backTo" value={backTo} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {!patientId && patients ? (
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`pm-patient-${visitId ?? "x"}`}>
              المريض
            </label>
            <select id={`pm-patient-${visitId ?? "x"}`} name="patientId" required className="input" defaultValue="">
              <option value="" disabled>
                اختر المريض
              </option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <AmountCurrencyFields idPrefix={`pm-${visitId ?? "x"}`} base={baseCurrency} currencies={currencies} defaultValue={suggested} />

        <div>
          <label className="label" htmlFor={`pm-method-${visitId ?? "x"}`}>
            طريقة الدفع
          </label>
          <select id={`pm-method-${visitId ?? "x"}`} name="method" className="input" defaultValue="cash">
            <option value="cash">نقداً</option>
            <option value="card">شبكة / بطاقة</option>
            <option value="transfer">تحويل بنكي</option>
            <option value="insurance">تأمين</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`pm-date-${visitId ?? "x"}`}>
            تاريخ الدفع
          </label>
          <input id={`pm-date-${visitId ?? "x"}`} name="paidAt" type="date" defaultValue={todayISO()} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`pm-note-${visitId ?? "x"}`}>
            ملاحظة
          </label>
          <input id={`pm-note-${visitId ?? "x"}`} name="note" className="input" placeholder="دفعة أولى..." />
        </div>
      </div>

      {state?.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-medium text-emerald-600">تم تسجيل الدفعة.</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "جارٍ التسجيل..." : "تسجيل الدفعة"}
      </button>
    </form>
  );
}
