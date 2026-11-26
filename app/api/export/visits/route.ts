import { getCurrentUser } from "@/lib/auth";
import { appointmentsInRange } from "@/lib/queries";
import { all } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatShortDate, monthRange, todayISO } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  booked: "محجوز",
  arrived: "حضر",
  waiting: "في الانتظار",
  in_visit: "داخل المعاينة",
  done: "انتهت",
  no_show: "لم يحضر",
  cancelled: "ملغي",
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new Response("غير مصرح", { status: 401 });

  const params = new URL(request.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : todayISO().slice(0, 7);
  const fallback = monthRange(month);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") ?? "") ? (params.get("from") as string) : fallback.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get("to") ?? "") ? (params.get("to") as string) : fallback.to;

  const appointments = appointmentsInRange(user.clinicId, from, to);
  const visits = all<{
    id: string;
    patient_name: string;
    visit_date: string;
    doctor_name: string;
    diagnosis: string;
    treatment: string;
    fee: number;
    discount: number;
  }>(
    `SELECT v.id, p.name AS patient_name, v.visit_date, u.name AS doctor_name, v.diagnosis, v.treatment, v.fee, v.discount
       FROM visits v JOIN patients p ON p.id = v.patient_id JOIN users u ON u.id = v.doctor_id
      WHERE v.clinic_id = ? AND substr(v.visit_date, 1, 10) BETWEEN ? AND ?
      ORDER BY v.visit_date`,
    [user.clinicId, from, to],
  );

  if (params.get("type") === "visits") {
    const body = toCsv(
      ["التاريخ", "المريض", "الطبيب", "التشخيص", "العلاج", "قيمة الكشف", "الخصم", "المستحق", "العملة"],
      visits.map((visit) => [
        formatShortDate(visit.visit_date),
        visit.patient_name,
        visit.doctor_name,
        visit.diagnosis,
        visit.treatment,
        Number(visit.fee).toFixed(2),
        Number(visit.discount).toFixed(2),
        (Number(visit.fee) - Number(visit.discount)).toFixed(2),
        user.currency,
      ]),
    );
    return csvResponse(`visits-${from}-${to}.csv`, body);
  }

  const body = toCsv(
    ["التاريخ", "الوقت", "المريض", "الطبيب", "السبب", "الحالة", "المدة (دقيقة)"],
    appointments.map((appointment) => [
      formatShortDate(appointment.starts_at),
      appointment.starts_at.slice(11, 16),
      appointment.patient_name,
      appointment.doctor_name,
      appointment.reason,
      STATUS_LABEL[appointment.status] ?? appointment.status,
      appointment.duration,
    ]),
  );
  return csvResponse(`appointments-${from}-${to}.csv`, body);
}
