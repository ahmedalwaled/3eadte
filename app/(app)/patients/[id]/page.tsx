import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser, requirePerm } from "@/lib/auth";
import { all } from "@/lib/db";
import {
  clinicCurrencies,
  patientBalance,
  patientById,
  paymentsForPatient,
  prescriptionsForPatient,
  visitsForPatient,
} from "@/lib/queries";
import { age, formatDate, formatShortDate, money, initials, timeOf } from "@/lib/format";
import { uploadAttachment, deleteAttachment, toggleAttachmentShare, deletePatient } from "@/lib/actions/patients";
import { deletePayment } from "@/lib/actions/finance";
import { deletePrescription } from "@/lib/actions/visits";
import PaymentForm from "@/components/PaymentForm";
import CopyButton from "@/components/CopyButton";
import { EmptyState } from "@/components/ui";
import { CalendarIcon, FileIcon, PillIcon, PlusIcon, PrintIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "visits", label: "الزيارات" },
  { key: "prescriptions", label: "الوصفات" },
  { key: "payments", label: "الحسابات" },
  { key: "files", label: "المرفقات" },
];

type PrescriptionItem = { drug: string; dose: string; frequency: string; duration: string };

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireClinicUser();
  requirePerm(user, "patients");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const patient = await patientById(user.clinicId, id);
  if (!patient) notFound();

  const visits = await visitsForPatient(user.clinicId, id);
  const prescriptions = await prescriptionsForPatient(user.clinicId, id);
  const payments = await paymentsForPatient(user.clinicId, id);
  const attachments = await all<{ id: string; original_name: string; mime: string; size: number; share_with_portal: number; created_at: string }>(
    "SELECT id, original_name, mime, size, share_with_portal, created_at FROM attachments WHERE clinic_id = ? AND patient_id = ? ORDER BY created_at DESC",
    [user.clinicId, id],
  );
  const upcoming = await all<{ id: string; starts_at: string; status: string; reason: string }>(
    "SELECT id, starts_at, status, reason FROM appointments WHERE clinic_id = ? AND patient_id = ? AND starts_at >= ? ORDER BY starts_at LIMIT 5",
    [user.clinicId, id, new Date().toISOString().slice(0, 16)],
  );
  const balance = await patientBalance(user.clinicId, id);
  const currencies = await clinicCurrencies(user.clinicId);
  const isDoctor = user.role === "doctor";

  return (
    <div>
      <div className="card card-pad">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-700 text-lg font-bold text-white">
            {initials(patient.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-slate-900">{patient.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              ملف <span className="font-mono">{patient.code}</span> · {patient.gender === "female" ? "أنثى" : "ذكر"} · {age(patient.birth_date)} ·{" "}
              <span dir="ltr">{patient.phone}</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">مسجل منذ {formatDate(patient.created_at.slice(0, 10))}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/appointments/new?patientId=${patient.id}`} className="btn-ghost !px-3 !py-2 text-xs">
              <CalendarIcon className="size-4" />
              حجز موعد
            </Link>
            {isDoctor ? (
              <Link href={`/patients/${patient.id}/visits/new`} className="btn-primary !px-3 !py-2 text-xs">
                <PlusIcon className="size-4" />
                زيارة جديدة
              </Link>
            ) : null}
            <Link href={`/patients/${patient.id}/edit`} className="btn-ghost !px-3 !py-2 text-xs">
              تعديل
            </Link>
            <Link href={`/patients/${patient.id}/statement`} className="btn-ghost !px-3 !py-2 text-xs" target="_blank">
              <PrintIcon className="size-4" />
              كشف حساب
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">عدد الزيارات</p>
            <p className="text-base font-bold text-slate-800">{visits.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">إجمالي المستحق</p>
            <p className="text-base font-bold text-slate-800">{money(balance.due, user.currency)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">المدفوع</p>
            <p className="text-base font-bold text-emerald-700">{money(balance.paid, user.currency)}</p>
          </div>
          <div className={`rounded-xl px-3 py-2 ${balance.outstanding > 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
            <p className="text-[11px] text-slate-500">المتبقي</p>
            <p className={`text-base font-bold ${balance.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {money(balance.outstanding, user.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200/80">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/patients/${patient.id}?tab=${item.key}`}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === item.key ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card card-pad lg:col-span-2">
              <h2 className="section-title mb-3">آخر الزيارات</h2>
              {visits.length === 0 ? (
                <EmptyState title="لا توجد زيارات بعد" body="ابدأ زيارة جديدة لإنشاء الملف الطبي." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visits.slice(0, 4).map((visit) => (
                    <li key={visit.id} className="flex items-start gap-3 py-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800">
                        <FileIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/visits/${visit.id}`} className="text-sm font-bold text-slate-800 hover:text-brand-700">
                          {visit.diagnosis || "زيارة"}
                        </Link>
                        <p className="truncate text-[11px] text-slate-500">
                          {formatShortDate(visit.visit_date)} · {visit.doctor_name}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{money(visit.fee - visit.discount, user.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/patients/${patient.id}?tab=visits`} className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
                عرض كل الزيارات
              </Link>
            </section>

            <div className="space-y-4">
              <section className="card card-pad">
                <h2 className="section-title mb-2">البيانات</h2>
                <dl className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">العنوان</dt>
                    <dd className="text-slate-800">{patient.address || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">آخر زيارة</dt>
                    <dd className="text-slate-800">{patient.last_visit ? formatShortDate(patient.last_visit) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">ملاحظات</dt>
                    <dd className="max-w-40 truncate text-slate-800">{patient.notes || "—"}</dd>
                  </div>
                </dl>
              </section>

              <section className="card card-pad">
                <h2 className="section-title mb-2">بوابة المريض</h2>
                <p className="text-[11px] text-slate-500">رابط خاص لعرض المواعيد والتقارير المعتمدة والوصفات.</p>
                <div className="mt-2 flex items-center gap-2">
                  <Link href={`/portal/${patient.portal_token}`} className="truncate text-xs font-semibold text-brand-700 hover:underline" dir="ltr">
                    /portal/{patient.portal_token.slice(0, 8)}…
                  </Link>
                  <CopyButton value={`/portal/${patient.portal_token}`} label="نسخ" />
                </div>
              </section>

              <section className="card card-pad">
                <h2 className="section-title mb-2">مواعيد قادمة</h2>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد مواعيد قادمة.</p>
                ) : (
                  <ul className="space-y-1.5 text-[13px]">
                    {upcoming.map((appt) => (
                      <li key={appt.id} className="flex items-center justify-between gap-2">
                        <span className="text-slate-700">
                          {formatShortDate(appt.starts_at)} · {timeOf(appt.starts_at)}
                        </span>
                        <span className="truncate text-[11px] text-slate-400">{appt.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isDoctor ? (
                <form action={deletePatient} className="card card-pad">
                  <input type="hidden" name="id" value={patient.id} />
                  <h2 className="section-title mb-1 text-sm">حذف الملف</h2>
                  <p className="mb-2 text-[11px] text-slate-500">يحذف الزيارات والوصفات والمدفوعات نهائياً.</p>
                  <button className="btn-danger w-full !py-2 text-xs">حذف المريض نهائياً</button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "visits" ? (
          <div className="space-y-3">
            {visits.length === 0 ? (
              <EmptyState title="لا توجد زيارات" body="سجّل أول زيارة للمريض لتوثيق التشخيص والعلاج." />
            ) : (
              visits.map((visit) => (
                <article key={visit.id} className="card card-pad">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{visit.diagnosis || "زيارة بدون تشخيص"}</h3>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(visit.visit_date)} · {visit.doctor_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600 ring-slate-200">{money(visit.fee - visit.discount, user.currency)}</span>
                      <Link href={`/visits/${visit.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        التفاصيل
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] text-slate-600">{visit.complaint}</p>
                </article>
              ))
            )}
          </div>
        ) : null}

        {tab === "prescriptions" ? (
          <div className="space-y-3">
            {prescriptions.length === 0 ? (
              <EmptyState title="لا توجد وصفات" body="تُنشأ الوصفات من داخل صفحة الزيارة." />
            ) : (
              prescriptions.map((prescription) => {
                let items: PrescriptionItem[] = [];
                try {
                  items = JSON.parse(prescription.items);
                } catch {
                  items = [];
                }
                return (
                  <article key={prescription.id} className="card card-pad">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <PillIcon className="size-4 text-brand-700" />
                        وصفة {formatShortDate(prescription.created_at)}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Link href={`/prescriptions/${prescription.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                          <PrintIcon className="size-4" />
                          عرض وطباعة
                        </Link>
                        {isDoctor ? (
                          <form action={deletePrescription}>
                            <input type="hidden" name="id" value={prescription.id} />
                            <button className="btn-danger !px-3 !py-1.5 text-xs">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
                      {items.map((item, index) => (
                        <li key={index} className="flex flex-wrap gap-x-2 rounded-lg bg-slate-50 px-3 py-1.5">
                          <span className="font-semibold">{item.drug}</span>
                          <span className="text-slate-500">
                            {item.dose} · {item.frequency} · {item.duration}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {prescription.instructions ? <p className="mt-2 text-[11px] text-slate-500">{prescription.instructions}</p> : null}
                  </article>
                );
              })
            )}
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card card-pad lg:col-span-2">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <WalletIcon className="size-5 text-brand-700" />
                سجل المدفوعات
              </h2>
              {payments.length === 0 ? (
                <EmptyState title="لا توجد مدفوعات" body="سجّل دفعة من النموذج المجاور." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="th">التاريخ</th>
                        <th className="th">المبلغ</th>
                        <th className="th">الطريقة</th>
                        <th className="th">ملاحظة</th>
                        <th className="th" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="td whitespace-nowrap">{formatShortDate(payment.paid_at)}</td>
                          <td className="td font-semibold text-emerald-700">
                            {money(payment.amount, payment.currency || user.currency)}
                            {payment.currency && payment.currency !== user.currency ? (
                              <span className="block text-[11px] font-medium text-slate-400">
                                ≈ {money(payment.amount * Number(payment.rate || 1), user.currency)}
                              </span>
                            ) : null}
                          </td>
                          <td className="td">{payment.method === "cash" ? "نقداً" : payment.method === "card" ? "شبكة" : payment.method === "transfer" ? "تحويل" : "تأمين"}</td>
                          <td className="td text-slate-500">{payment.note || "—"}</td>
                          <td className="td text-left">
                            {isDoctor ? (
                              <form action={deletePayment}>
                                <input type="hidden" name="id" value={payment.id} />
                                <button className="text-xs font-semibold text-rose-600 hover:underline">حذف</button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card card-pad">
              <h2 className="section-title mb-1">كشف حساب</h2>
              <div className="mb-3 space-y-1 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">المستحق</span>
                  <span className="font-semibold">{money(balance.due, user.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المدفوع</span>
                  <span className="font-semibold text-emerald-700">{money(balance.paid, user.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-500">المتبقي</span>
                  <span className="font-bold text-rose-700">{money(balance.outstanding, user.currency)}</span>
                </div>
              </div>
              <PaymentForm
                patientId={patient.id}
                suggested={balance.outstanding}
                backTo={`/patients/${patient.id}?tab=payments`}
                baseCurrency={user.currency}
                currencies={currencies}
              />
            </section>
          </div>
        ) : null}

        {tab === "files" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card card-pad lg:col-span-2">
              <h2 className="section-title mb-3">المرفقات</h2>
              {attachments.length === 0 ? (
                <EmptyState title="لا توجد مرفقات" body="يمكنك رفع صور الأشعة أو تقارير التحاليل." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attachments.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 py-2.5">
                      <FileIcon className="size-5 shrink-0 text-slate-400" />
                      <a href={`/api/files/${file.id}`} target="_blank" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-700 hover:underline">
                        {file.original_name}
                      </a>
                      <span className="text-[11px] text-slate-400">{Math.round(file.size / 1024)} ك.ب</span>
                      {isDoctor ? (
                        <>
                          <form action={toggleAttachmentShare}>
                            <input type="hidden" name="id" value={file.id} />
                            <button className={`text-xs font-semibold hover:underline ${file.share_with_portal ? "text-emerald-700" : "text-slate-400"}`}>
                              {file.share_with_portal ? "مشارَك مع البوابة" : "مشاركة مع البوابة"}
                            </button>
                          </form>
                          <form action={deleteAttachment}>
                            <input type="hidden" name="id" value={file.id} />
                            <button className="text-xs font-semibold text-rose-600 hover:underline">حذف</button>
                          </form>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card card-pad">
              <h2 className="section-title mb-2">رفع مرفق</h2>
              <form action={uploadAttachment} className="space-y-3">
                <input type="hidden" name="patientId" value={patient.id} />
                <input type="file" name="file" required className="input !py-2 text-xs" accept="image/*,application/pdf" />
                <p className="text-[11px] text-slate-400">الحد الأقصى 10 ميجابايت — صور أو PDF.</p>
                <button className="btn-primary w-full !py-2 text-xs">رفع</button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
