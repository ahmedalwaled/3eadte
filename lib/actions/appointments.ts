"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClinicUser } from "@/lib/auth";
import { get, run, newId, nowIso } from "@/lib/db";
import { findConflict } from "@/lib/queries";

export type ActionResult = { error?: string; ok?: boolean };

function revalidateAll(patientId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  revalidatePath("/patients");
  revalidatePath("/notifications");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

async function notify(clinicId: string, title: string, body: string, kind = "appointment") {
  await run("INSERT INTO notifications (id, clinic_id, user_id, title, body, kind, created_at) VALUES (?,?,?,?,?,?,?)", [
    newId(),
    clinicId,
    null,
    title,
    body,
    kind,
    nowIso(),
  ]);
}

function normalizeTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

function normalizeDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

export async function createAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser();
  const clinicId = user.clinicId;

  const date = normalizeDate(String(formData.get("date") ?? ""));
  const time = normalizeTime(String(formData.get("time") ?? ""));
  const duration = Math.min(240, Math.max(10, Number(formData.get("duration") ?? 20) || 20));
  const reason = String(formData.get("reason") ?? "").trim();
  let patientId = String(formData.get("patientId") ?? "").trim();
  let doctorId = String(formData.get("doctorId") ?? "").trim();

  if (!date || !time) return { error: "حدد التاريخ والوقت بشكل صحيح" };

  if (!doctorId) {
    doctorId =
      (await get<{ id: string }>("SELECT id FROM users WHERE clinic_id = ? AND role = 'doctor' AND active = 1 LIMIT 1", [clinicId]))?.id ?? "";
  }
  if (!doctorId) return { error: "لا يوجد طبيب مفعّل في العيادة" };

  if (!patientId) {
    const name = String(formData.get("newPatientName") ?? "").trim();
    const phone = String(formData.get("newPatientPhone") ?? "").trim();
    if (!name) return { error: "اختر مريضاً مسجلاً أو أدخل اسم مريض جديد" };
    const count = Number((await get<{ n: number }>("SELECT COUNT(*) AS n FROM patients WHERE clinic_id = ?", [clinicId]))?.n ?? 0);
    patientId = newId();
    await run(
      `INSERT INTO patients (id, clinic_id, code, name, phone, gender, birth_date, address, notes, portal_token, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        patientId,
        clinicId,
        `P-${String(count + 1).padStart(4, "0")}`,
        name,
        phone,
        "male",
        "",
        "",
        "",
        newId().replace(/-/g, "").slice(0, 16),
        nowIso(),
      ],
    );
  } else {
    const patient = await get<{ id: string; name: string }>("SELECT id, name FROM patients WHERE id = ? AND clinic_id = ?", [
      patientId,
      clinicId,
    ]);
    if (!patient) return { error: "المريض غير موجود في هذه العيادة" };
  }

  const startsAt = `${date}T${time}`;
  const conflict = await findConflict(clinicId, doctorId, startsAt, duration);
  if (conflict) {
    return { error: `يوجد تعارض مع موعد ${conflict.patient_name} الساعة ${conflict.starts_at.slice(11, 16)}` };
  }

  await run(
    "INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, starts_at, duration, reason, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [newId(), clinicId, patientId, doctorId, startsAt, duration, reason, "booked", nowIso()],
  );

  const patientName = (await get<{ name: string }>("SELECT name FROM patients WHERE id = ?", [patientId]))?.name ?? "مريض";
  await notify(clinicId, "موعد جديد", `${patientName} — ${date} الساعة ${time}`, "appointment");
  revalidateAll(patientId);
  redirect(`/appointments?date=${date}`);
}

export async function updateAppointmentStatus(formData: FormData) {
  const user = await requireClinicUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["booked", "arrived", "waiting", "in_visit", "done", "no_show", "cancelled"];
  if (!allowed.includes(status)) return;

  const appt = await get<{ id: string; patient_id: string; starts_at: string; status: string }>(
    "SELECT id, patient_id, starts_at, status FROM appointments WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!appt) return;

  await run("UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?", [status, id, user.clinicId]);

  const patientName = (await get<{ name: string }>("SELECT name FROM patients WHERE id = ?", [appt.patient_id]))?.name ?? "مريض";
  if (status === "cancelled") {
    await notify(
      user.clinicId,
      "إلغاء موعد",
      `تم إلغاء موعد ${patientName} — ${appt.starts_at.slice(0, 10)} ${appt.starts_at.slice(11, 16)}`,
      "warning",
    );
  }
  if (status === "arrived") {
    await notify(user.clinicId, "تأكيد حضور", `حضر المريض ${patientName} لموعده`, "info");
  }
  revalidateAll(appt.patient_id);
}

export async function rescheduleAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser();
  const id = String(formData.get("id") ?? "");
  const date = normalizeDate(String(formData.get("date") ?? ""));
  const time = normalizeTime(String(formData.get("time") ?? ""));
  const duration = Math.min(240, Math.max(10, Number(formData.get("duration") ?? 20) || 20));
  if (!date || !time) return { error: "حدد التاريخ والوقت بشكل صحيح" };

  const appt = await get<{ id: string; patient_id: string; doctor_id: string }>(
    "SELECT id, patient_id, doctor_id FROM appointments WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!appt) return { error: "الموعد غير موجود" };

  const startsAt = `${date}T${time}`;
  const conflict = await findConflict(user.clinicId, appt.doctor_id, startsAt, duration, id);
  if (conflict) {
    return { error: `يوجد تعارض مع موعد ${conflict.patient_name} الساعة ${conflict.starts_at.slice(11, 16)}` };
  }

  await run("UPDATE appointments SET starts_at = ?, duration = ? WHERE id = ? AND clinic_id = ?", [startsAt, duration, id, user.clinicId]);
  const patientName = (await get<{ name: string }>("SELECT name FROM patients WHERE id = ?", [appt.patient_id]))?.name ?? "مريض";
  await notify(user.clinicId, "تعديل موعد", `تم نقل موعد ${patientName} إلى ${date} الساعة ${time}`, "warning");
  revalidateAll(appt.patient_id);
  redirect(`/appointments?date=${date}`);
}

export async function deleteAppointment(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const appt = await get<{ patient_id: string }>("SELECT patient_id FROM appointments WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!appt) return;
  await run("DELETE FROM appointments WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  revalidateAll(appt.patient_id);
}
