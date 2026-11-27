import Link from "next/link";
import { requireClinicUser, requirePerm } from "@/lib/auth";
import { patientList } from "@/lib/queries";
import { age, formatShortDate, money, initials } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { DownloadIcon, PlusIcon } from "@/components/icons";
import PatientSearch from "@/components/PatientSearch";
import Highlight, { matches } from "@/components/Highlight";

export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireClinicUser();
  requirePerm(user, "patients");
  const { q = "" } = await searchParams;
  const patients = await patientList(user.clinicId, q);

  return (
    <div>
      <PageHeader
        title="المرضى"
        subtitle={`${patients.length} ملف${patients.length === 1 ? "" : "اً"} ${q ? `مطابق لـ «${q}»` : "في العيادة"}`}
        actions={
          <>
            <Link href={`/api/export/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost" prefetch={false}>
              <DownloadIcon className="size-4" />
              Excel
            </Link>
            <Link href="/patients/new" className="btn-primary">
              <PlusIcon className="size-4" />
              مريض جديد
            </Link>
          </>
        }
      />

      <PatientSearch initial={q} />

      {patients.length === 0 ? (
        <EmptyState
          title="لا توجد نتائج"
          body="جرّب البحث برقم آخر أو أضف مريضاً جديداً."
          action={
            <Link href="/patients/new" className="btn-soft mt-2">
              إضافة مريض
            </Link>
          }
        />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="th">المريض</th>
                  <th className="th">رقم الملف</th>
                  <th className="th">الجوال</th>
                  <th className="th">العمر</th>
                  <th className="th">آخر زيارة</th>
                  <th className="th">الرصيد</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <Link href={`/patients/${patient.id}`} className="flex items-center gap-2 font-bold text-slate-800 hover:text-brand-700">
                        <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-800">
                          {initials(patient.name)}
                        </span>
                        <span>
                          <Highlight text={patient.name} query={q} />
                        </span>
                      </Link>
                    </td>
                    <td className="td font-mono text-xs text-slate-500">
                      <Highlight text={patient.code} query={q} />
                    </td>
                    <td className="td" dir="ltr">
                      <Highlight text={patient.phone} query={q} />
                    </td>
                    <td className="td">{age(patient.birth_date)}</td>
                    <td className="td">{patient.last_visit ? formatShortDate(patient.last_visit) : "—"}</td>
                    <td className="td">
                      <span
                        className={`badge ${
                          patient.balance > 0 ? "bg-rose-50 text-rose-900 ring-rose-300" : "bg-emerald-50 text-emerald-900 ring-emerald-300"
                        }`}
                      >
                        {money(patient.balance, user.currency)}
                      </span>
                    </td>
                    <td className="td text-left">
                      <Link href={`/patients/${patient.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        فتح الملف
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link href={`/patients/${patient.id}`} className="card card-pad flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-800">
                    {initials(patient.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                      <Highlight text={patient.name} query={q} />
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      <Highlight text={patient.code} query={q} /> · {age(patient.birth_date)} ·{" "}
                      {patient.last_visit ? formatShortDate(patient.last_visit) : "لا زيارات"}
                    </p>
                    {matches(patient.phone, q) ? (
                      <p className="truncate text-[11px] text-slate-500" dir="ltr">
                        <Highlight text={patient.phone} query={q} />
                      </p>
                    ) : null}
                  </div>
                  <span className={`badge ${patient.balance > 0 ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
                    {money(patient.balance, user.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
