import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { patientById, patientBalance, visitById } from "@/lib/queries";
import { formatDate, money } from "@/lib/format";
import { updateVisit } from "@/lib/actions/visits";
import VisitForm from "@/components/VisitForm";
import PrescriptionForm from "@/components/PrescriptionForm";
import PaymentForm from "@/components/PaymentForm";
import { PageHeader } from "@/components/ui";
import { PillIcon, PrintIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type PrescriptionRow = { id: string; items: string; instructions: string; created_at: string };
type Item = { drug: string; dose: string; frequency: string; duration: string };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser();
  const { id } = await params;
  const visit = await visitById(user.clinicId, id);
  if (!visit) notFound();

  const patient = await patientById(user.clinicId, visit.patient_id);
  if (!patient) notFound();

  const prescriptions = await all<PrescriptionRow>(
    "SELECT id, items, instructions, created_at FROM prescriptions WHERE clinic_id = ? AND visit_id = ? ORDER BY created_at DESC",
    [user.clinicId, id],
  );
  const balance = await patientBalance(user.clinicId, patient.id);
  const isDoctor = user.role === "doctor";

  return (
    <div>
      <PageHeader
        title={`زيارة ${patient.name}`}
        subtitle={`${formatDate(visit.visit_date)} · ${visit.doctor_name}`}
        actions={
          <Link href={`/patients/${patient.id}`} className="btn-ghost">
            ملف المريض
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isDoctor ? (
            <VisitForm
              action={updateVisit}
              patientId={patient.id}
              patientName={patient.name}
              values={visit}
              submitLabel="حفظ التعديلات"
              cancelHref={`/patients/${patient.id}`}
            />
          ) : (
            <section className="card card-pad space-y-3 text-[13px]">
              <h2 className="section-title">تفاصيل الزيارة</h2>
              {[
                ["الشكوى", visit.complaint],
                ["العلامات الحيوية", visit.vitals],
                ["الفحص", visit.exam],
                ["التشخيص", visit.diagnosis],
                ["العلاج", visit.treatment],
                ["التوصيات", visit.recommendations],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="text-slate-800">{value || "—"}</p>
                </div>
              ))}
            </section>
          )}

          {isDoctor ? (
            <section className="card card-pad">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <PillIcon className="size-5 text-brand-700" />
                وصفة جديدة
              </h2>
              <PrescriptionForm visitId={visit.id} />
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="card card-pad">
            <h2 className="section-title mb-2">ملخص</h2>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">قيمة الكشف</dt>
                <dd className="font-semibold">{money(visit.fee, user.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">الخصم</dt>
                <dd className="font-semibold">{money(visit.discount, user.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <dt className="text-slate-500">المستحق</dt>
                <dd className="font-bold text-brand-800">{money(visit.fee - visit.discount, user.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">رصيد المريض</dt>
                <dd className={`font-bold ${balance.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {money(balance.outstanding, user.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">موعد المراجعة</dt>
                <dd className="font-semibold">{visit.follow_up ? formatDate(visit.follow_up) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="section-title mb-2">وصفات الزيارة</h2>
            {prescriptions.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد وصفات لهذه الزيارة.</p>
            ) : (
              <ul className="space-y-2">
                {prescriptions.map((prescription) => {
                  let items: Item[] = [];
                  try {
                    items = JSON.parse(prescription.items);
                  } catch {
                    items = [];
                  }
                  return (
                    <li key={prescription.id} className="rounded-xl bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-slate-800">{items.length} دواء</span>
                        <Link href={`/prescriptions/${prescription.id}`} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                          <PrintIcon className="size-3.5" />
                          طباعة
                        </Link>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{items.map((item) => item.drug).join("، ")}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="section-title mb-2">تسجيل دفعة</h2>
            <PaymentForm
              patientId={patient.id}
              visitId={visit.id}
              suggested={Math.max(0, visit.fee - visit.discount)}
              backTo={`/visits/${visit.id}`}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
