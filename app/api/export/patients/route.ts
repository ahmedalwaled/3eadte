import { getCurrentUser } from "@/lib/auth";
import { patientList } from "@/lib/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { age, formatShortDate } from "@/lib/format";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new Response("غير مصرح", { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const patients = await patientList(user.clinicId, q, 5000);

  const body = toCsv(
    ["رقم الملف", "الاسم", "الجوال", "الجنس", "تاريخ الميلاد", "العمر", "العنوان", "عدد الزيارات", "آخر زيارة", "الرصيد"],
    patients.map((patient) => [
      patient.code,
      patient.name,
      patient.phone,
      patient.gender === "female" ? "أنثى" : "ذكر",
      patient.birth_date,
      age(patient.birth_date),
      patient.address,
      patient.visits_count,
      patient.last_visit ? formatShortDate(patient.last_visit) : "",
      Number(patient.balance).toFixed(2),
    ]),
  );

  return csvResponse(`patients-${new Date().toISOString().slice(0, 10)}.csv`, body);
}
