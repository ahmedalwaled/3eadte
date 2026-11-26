import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { patientById, prescriptionById } from "@/lib/queries";
import { age, formatDate } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Item = { drug: string; dose: string; frequency: string; duration: string };

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser();
  const { id } = await params;
  const prescription = await prescriptionById(user.clinicId, id);
  if (!prescription) notFound();

  const patient = await patientById(user.clinicId, prescription.patient_id);
  if (!patient) notFound();

  const clinic = await get<{ name: string; phone: string; address: string }>("SELECT name, phone, address FROM clinics WHERE id = ?", [user.clinicId]);

  let items: Item[] = [];
  try {
    items = JSON.parse(prescription.items);
  } catch {
    items = [];
  }

  return (
    <main className="mx-auto max-w-3xl bg-white px-5 py-8 sm:my-6 sm:rounded-2xl sm:ring-1 sm:ring-slate-200">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/patients/${patient.id}?tab=prescriptions`} className="btn-ghost">
          رجوع
        </Link>
        <PrintButton label="طباعة الوصفة" />
      </div>

      <header className="flex items-start justify-between border-b-2 border-brand-700 pb-4">
        <div>
          <p className="text-xl font-extrabold text-brand-800">{clinic?.name ?? user.clinicName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{clinic?.address}</p>
          <p className="text-xs text-slate-500" dir="ltr">
            {clinic?.phone}
          </p>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-slate-700">وصفة طبية</p>
          <p className="text-[11px] text-slate-500">{formatDate(prescription.created_at.slice(0, 10))}</p>
          <p className="font-mono text-[11px] text-slate-400">Rx-{prescription.id.slice(0, 6).toUpperCase()}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[13px]">
        <p>
          <span className="text-slate-500">المريض: </span>
          <span className="font-semibold text-slate-800">{patient.name}</span>
        </p>
        <p>
          <span className="text-slate-500">العمر: </span>
          {age(patient.birth_date)}
        </p>
        <p>
          <span className="text-slate-500">رقم الملف: </span>
          <span className="font-mono">{patient.code}</span>
        </p>
        <p>
          <span className="text-slate-500">الجوال: </span>
          <span dir="ltr">{patient.phone}</span>
        </p>
      </section>

      <table className="mt-5 w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-brand-50 text-brand-800">
            <th className="border border-brand-100 px-3 py-2 text-right">#</th>
            <th className="border border-brand-100 px-3 py-2 text-right">الدواء</th>
            <th className="border border-brand-100 px-3 py-2 text-right">الجرعة</th>
            <th className="border border-brand-100 px-3 py-2 text-right">التكرار</th>
            <th className="border border-brand-100 px-3 py-2 text-right">المدة</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="border border-slate-200 px-3 py-2 text-slate-500">{index + 1}</td>
              <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-800">{item.drug}</td>
              <td className="border border-slate-200 px-3 py-2">{item.dose}</td>
              <td className="border border-slate-200 px-3 py-2">{item.frequency}</td>
              <td className="border border-slate-200 px-3 py-2">{item.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {prescription.instructions ? (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <span className="font-semibold">تعليمات: </span>
          {prescription.instructions}
        </div>
      ) : null}

      <footer className="mt-10 flex items-end justify-between text-[12px] text-slate-500">
        <div>
          <p className="font-semibold text-slate-700">{prescription.doctor_name}</p>
          <p>{user.specialty || "طبيب العيادة"}</p>
        </div>
        <div className="text-left">
          <p className="mb-6">التوقيع: ____________________</p>
          <p className="text-[10px] text-slate-400">هذه الوصفة صادرة إلكترونياً من منصة عيادتي</p>
        </div>
      </footer>
    </main>
  );
}
