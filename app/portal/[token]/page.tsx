import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { portalCookieName, portalCookieValue } from "@/lib/portal";
import { portalLogout } from "@/lib/actions/portal";
import PortalVerify from "@/components/PortalVerify";
import { age, formatDate, formatShortDate, money, timeOf } from "@/lib/format";

export const dynamic = "force-dynamic";

type Item = { drug: string; dose: string; frequency: string; duration: string };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await get<{ id: string; clinic_id: string; name: string; code: string; birth_date: string; gender: string; phone: string }>(
    "SELECT id, clinic_id, name, code, birth_date, gender, phone FROM patients WHERE portal_token = ?",
    [token],
  );
  if (!patient) notFound();

  const clinic = await get<{ name: string; phone: string; address: string; currency: string }>(
    "SELECT name, phone, address, currency FROM clinics WHERE id = ?",
    [patient.clinic_id],
  );
  const currency = clinic?.currency ?? "SYP";

  const store = await cookies();
  const expected = portalCookieValue(patient.id, token);
  const verified = store.get(portalCookieName(token))?.value === expected;

  if (!verified) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,#e6f6f1,transparent_60%)] px-4 py-10">
        <PortalVerify token={token} clinicName={clinic?.name ?? "العيادة"} />
      </main>
    );
  }

  const appointments = await all<{ id: string; starts_at: string; status: string; reason: string }>(
    "SELECT id, starts_at, status, reason FROM appointments WHERE patient_id = ? AND starts_at >= ? ORDER BY starts_at LIMIT 10",
    [patient.id, new Date().toISOString().slice(0, 16)],
  );
  const visits = await all<{ id: string; visit_date: string; diagnosis: string; treatment: string; recommendations: string; follow_up: string; doctor_name: string }>(
    `SELECT v.id, v.visit_date, v.diagnosis, v.treatment, v.recommendations, v.follow_up, u.name AS doctor_name
       FROM visits v JOIN users u ON u.id = v.doctor_id
      WHERE v.patient_id = ? AND v.shared = 1 ORDER BY v.visit_date DESC LIMIT 20`,
    [patient.id],
  );
  const prescriptions = await all<{ id: string; items: string; instructions: string; created_at: string }>(
    "SELECT id, items, instructions, created_at FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 10",
    [patient.id],
  );
  const attachments = await all<{ id: string; original_name: string; created_at: string }>(
    "SELECT id, original_name, created_at FROM attachments WHERE patient_id = ? AND share_with_portal = 1 ORDER BY created_at DESC LIMIT 20",
    [patient.id],
  );
  const balance = await get<{ due: number; paid: number }>(
    `SELECT COALESCE((SELECT SUM(fee - discount) FROM visits WHERE patient_id = ?), 0) AS due,
            COALESCE((SELECT SUM(amount * COALESCE(rate, 1)) FROM payments WHERE patient_id = ?), 0) AS paid`,
    [patient.id, patient.id],
  );
  const outstanding = Math.max(0, Number(balance?.due ?? 0) - Number(balance?.paid ?? 0));

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-6 sm:my-6 sm:rounded-2xl sm:ring-1 sm:ring-slate-200">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold text-brand-700">{clinic?.name}</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-slate-900">{patient.name}</h1>
          <p className="text-[11px] text-slate-500">
            ملف {patient.code} · {age(patient.birth_date)}
          </p>
        </div>
        <form action={portalLogout}>
          <input type="hidden" name="token" value={token} />
          <button className="btn-ghost !px-3 !py-1.5 text-[11px]">خروج</button>
        </form>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-brand-50 px-3 py-2.5">
          <p className="text-[11px] text-brand-800/70">مواعيد قادمة</p>
          <p className="text-lg font-extrabold text-brand-900">{appointments.length}</p>
        </div>
        <div className={`rounded-xl px-3 py-2.5 ${outstanding > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
          <p className="text-[11px] text-slate-500">المبلغ المتبقي</p>
          <p className={`text-lg font-extrabold ${outstanding > 0 ? "text-amber-800" : "text-emerald-800"}`}>{money(outstanding, currency)}</p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-slate-800">مواعيدك القادمة</h2>
        {appointments.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">لا توجد مواعيد قادمة.</p>
        ) : (
          <ul className="space-y-2">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">
                    {formatDate(appointment.starts_at.slice(0, 10))} · {timeOf(appointment.starts_at)}
                  </p>
                  <p className="text-[11px] text-slate-500">{appointment.reason || "زيارة"}</p>
                </div>
                <span className="badge bg-white text-slate-600 ring-slate-200">
                  {appointment.status === "cancelled" ? "ملغي" : appointment.status === "booked" ? "مؤكد" : "قيد التنفيذ"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-slate-800">زياراتك المعتمدة</h2>
        {visits.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">لا توجد زيارات مشاركة من العيادة.</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((visit: { id: string; visit_date: string; diagnosis: string; treatment: string; recommendations: string; follow_up: string; doctor_name: string }) => (
              <li key={visit.id} className="rounded-xl ring-1 ring-slate-200">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-[13px] font-bold text-slate-800">{visit.diagnosis}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatShortDate(visit.visit_date)} · {visit.doctor_name}
                  </p>
                </div>
                <dl className="space-y-1.5 px-3 py-2 text-[12px]">
                  {[
                    ["العلاج", visit.treatment],
                    ["التوصيات", visit.recommendations],
                    ["موعد المراجعة", visit.follow_up ? formatDate(visit.follow_up) : ""],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="font-semibold text-slate-500">{label}</dt>
                        <dd className="text-slate-700">{value}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-slate-800">وصفاتك</h2>
        {prescriptions.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">لا توجد وصفات.</p>
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
                <li key={prescription.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-slate-500">{formatShortDate(prescription.created_at)}</p>
                  <ul className="mt-1 space-y-1 text-[12px] text-slate-700">
                    {items.map((item, index) => (
                      <li key={index}>
                        <span className="font-semibold">{item.drug}</span>
                        <span className="text-slate-500">
                          {" "}
                          — {item.dose} · {item.frequency} · {item.duration}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {prescription.instructions ? <p className="mt-1 text-[11px] text-slate-500">{prescription.instructions}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-slate-800">ملفاتك ومرفقاتك</h2>
        {attachments.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">لا توجد ملفات مشاركة من العيادة.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{file.original_name}</p>
                  <p className="text-[11px] text-slate-500">{formatShortDate(file.created_at)}</p>
                </div>
                <a
                  href={`/api/portal/${token}/files/${file.id}`}
                  className="btn-ghost !px-3 !py-1.5 text-[11px]"
                  download
                >
                  تحميل
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-6 border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        <p>{clinic?.name}</p>
        <p>{clinic?.address}</p>
        <p dir="ltr">{clinic?.phone}</p>
        <p className="mt-1">هذه البوابة تعرض فقط ما تعتمده العيادة، ولا يمكن الوصول إليها دون التحقق من رقم الجوال.</p>
      </footer>
    </main>
  );
}
