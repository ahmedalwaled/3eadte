import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { patientBalance, patientById, paymentLedger, visitsForPatient } from "@/lib/queries";
import { age, currencySymbol, formatDate, formatShortDate, money, todayISO } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "شبكة", transfer: "تحويل", insurance: "تأمين" };

type Entry = {
  date: string;
  kind: "visit" | "payment";
  label: string;
  charge: number;
  credit: number;
  currency: string;
  rate: number;
};

export default async function PatientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireClinicUser();
  const { id } = await params;
  const sp = await searchParams;
  const patient = patientById(user.clinicId, id);
  if (!patient) notFound();

  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? (sp.from as string) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? (sp.to as string) : "";

  const clinic = get<{ name: string; phone: string; address: string }>("SELECT name, phone, address FROM clinics WHERE id = ?", [user.clinicId]);
  const balance = patientBalance(user.clinicId, id);

  const inRange = (date: string) => {
    const day = date.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  const visits = visitsForPatient(user.clinicId, id).filter((visit) => inRange(visit.visit_date));
  const payments = paymentLedger(user.clinicId, id, user.currency).filter((payment) => inRange(payment.paid_at));

  const entries: Entry[] = [
    ...visits.map<Entry>((visit) => ({
      date: visit.visit_date,
      kind: "visit",
      label: visit.diagnosis ? `زيارة — ${visit.diagnosis}` : "زيارة",
      charge: Number(visit.fee) - Number(visit.discount),
      credit: 0,
      currency: user.currency,
      rate: 1,
    })),
    ...payments.map<Entry>((payment) => ({
      date: payment.paid_at,
      kind: "payment",
      label: `دفعة — ${METHOD_LABEL[payment.method] ?? payment.method}${payment.note ? ` · ${payment.note}` : ""}`,
      charge: 0,
      credit: Number(payment.amount),
      currency: payment.currency,
      rate: Number(payment.rate || 1),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "visit" ? -1 : 1));

  let running = 0;
  const rows = entries.map((entry) => {
    const charge = entry.charge;
    const creditBase = entry.credit * entry.rate;
    running += charge - creditBase;
    return { ...entry, creditBase, balance: running };
  });

  const ledgerDue = rows.reduce((sum, row) => sum + row.charge, 0);
  const ledgerPaid = rows.reduce((sum, row) => sum + row.creditBase, 0);

  return (
    <main className="print-sheet px-5 py-6 sm:my-6 sm:rounded-2xl sm:ring-1 sm:ring-slate-200">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/patients/${id}?tab=payments`} className="btn-ghost">
          رجوع لملف المريض
        </Link>
        <div className="flex items-center gap-2">
          <form action={`/patients/${id}/statement`} className="flex flex-wrap items-center gap-2">
            <input type="date" name="from" defaultValue={from} className="input !py-2 text-[12px]" aria-label="من تاريخ" />
            <input type="date" name="to" defaultValue={to} className="input !py-2 text-[12px]" aria-label="إلى تاريخ" />
            <button className="btn-ghost !py-2 text-xs">عرض</button>
          </form>
          <PrintButton label="طباعة / حفظ PDF" />
        </div>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-brand-700 pb-3">
        <div>
          <p className="text-xl font-extrabold text-brand-800">{clinic?.name ?? user.clinicName}</p>
          {clinic?.address ? <p className="mt-0.5 text-xs text-slate-500">{clinic.address}</p> : null}
          {clinic?.phone ? (
            <p className="text-xs text-slate-500" dir="ltr">
              {clinic.phone}
            </p>
          ) : null}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-slate-700">كشف حساب</p>
          <p className="text-[11px] text-slate-500">
            {from || to ? `${from || "البداية"} — ${to || todayISO()}` : `حتى ${formatDate(todayISO())}`}
          </p>
          <p className="text-[11px] text-slate-400">العملة: {user.currency}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[12px]">
        <p>
          <span className="text-slate-500">المريض: </span>
          <span className="font-semibold text-slate-800">{patient.name}</span>
        </p>
        <p>
          <span className="text-slate-500">رقم الملف: </span>
          <span className="font-mono">{patient.code}</span>
        </p>
        <p>
          <span className="text-slate-500">العمر: </span>
          {age(patient.birth_date)}
        </p>
        <p>
          <span className="text-slate-500">الجوال: </span>
          <span dir="ltr">{patient.phone}</span>
        </p>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <div className="print-keep rounded-xl border border-slate-200 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-500">إجمالي المستحق</p>
          <p className="mt-0.5 text-[14px] font-extrabold text-slate-800">{money(ledgerDue, user.currency)}</p>
        </div>
        <div className="print-keep rounded-xl border border-slate-200 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-500">إجمالي المدفوع</p>
          <p className="mt-0.5 text-[14px] font-extrabold text-emerald-700">{money(ledgerPaid, user.currency)}</p>
        </div>
        <div className="print-keep rounded-xl border border-slate-200 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-500">الرصيد المتبقي</p>
          <p className={`mt-0.5 text-[14px] font-extrabold ${ledgerDue - ledgerPaid > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {money(Math.max(0, ledgerDue - ledgerPaid), user.currency)}
          </p>
        </div>
      </section>

      <table className="mt-5 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-brand-50 text-brand-800">
            <th className="border border-brand-100 px-2 py-2 text-right">التاريخ</th>
            <th className="border border-brand-100 px-2 py-2 text-right">البيان</th>
            <th className="border border-brand-100 px-2 py-2 text-right">مدين (زيارة)</th>
            <th className="border border-brand-100 px-2 py-2 text-right">دائن (دفعة)</th>
            <th className="border border-brand-100 px-2 py-2 text-right">الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="border border-slate-200 px-2 py-3 text-center text-slate-400">
                لا حركات في هذه الفترة
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.kind}-${index}`}>
                <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{formatShortDate(row.date)}</td>
                <td className="border border-slate-200 px-2 py-1.5">{row.label}</td>
                <td className="border border-slate-200 px-2 py-1.5">{row.charge ? money(row.charge, user.currency) : "—"}</td>
                <td className="border border-slate-200 px-2 py-1.5">
                  {row.credit ? (
                    <>
                      <span className="font-semibold text-emerald-700">{money(row.credit, row.currency)}</span>
                      {row.currency !== user.currency ? (
                        <span className="block text-[10px] text-slate-400">
                          ≈ {money(row.creditBase, user.currency)} ({currencySymbol(row.currency)} × {row.rate})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 font-semibold">{money(row.balance, user.currency)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-bold">
            <td className="border border-slate-200 px-2 py-2" colSpan={2}>
              الإجمالي
            </td>
            <td className="border border-slate-200 px-2 py-2">{money(ledgerDue, user.currency)}</td>
            <td className="border border-slate-200 px-2 py-2">{money(ledgerPaid, user.currency)}</td>
            <td className="border border-slate-200 px-2 py-2">{money(Math.max(0, ledgerDue - ledgerPaid), user.currency)}</td>
          </tr>
        </tfoot>
      </table>

      {from || to ? (
        <p className="mt-2 text-[10px] text-slate-400">
          رصيد الحساب الكلي منذ بداية الملف: مستحق {money(balance.due, user.currency)} · مدفوع {money(balance.paid, user.currency)} · متبقٍ{" "}
          {money(balance.outstanding, user.currency)}
        </p>
      ) : null}

      <footer className="mt-8 flex items-end justify-between text-[11px] text-slate-500">
        <p>تم إصدار الكشف آلياً من منصة عيادتي بتاريخ {formatDate(todayISO())}</p>
        <p className="mb-4">التوقيع: ____________________</p>
      </footer>
    </main>
  );
}
