"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClinicUser } from "@/lib/auth";
import { get, run, newId, nowIso } from "@/lib/db";
import type { ActionResult } from "./appointments";

function revalidateVisit(patientId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/appointments");
  revalidatePath("/reports");
  revalidatePath("/finance");
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createVisit(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const patientId = text(formData, "patientId");
  const appointmentId = text(formData, "appointmentId") || null;

  const patient = get<{ id: string; name: string }>("SELECT id, name FROM patients WHERE id = ? AND clinic_id = ?", [patientId, user.clinicId]);
  if (!patient) return { error: "المريض غير موجود" };

  const complaint = text(formData, "complaint");
  const diagnosis = text(formData, "diagnosis");
  if (!complaint) return { error: "أدخل الشكوى الرئيسية" };
  if (!diagnosis) return { error: "أدخل التشخيص قبل حفظ الزيارة" };

  const fee = Math.max(0, Number(formData.get("fee") ?? 0) || 0);
  const discount = Math.max(0, Number(formData.get("discount") ?? 0) || 0);
  const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(text(formData, "visitDate"))
    ? `${text(formData, "visitDate")}T${text(formData, "visitTime") || "10:00"}`
    : nowIso().slice(0, 16);

  const id = newId();
  run(
    `INSERT INTO visits (id, clinic_id, patient_id, appointment_id, doctor_id, visit_date, complaint, vitals, exam, diagnosis,
      treatment, recommendations, follow_up, fee, discount, shared, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      user.clinicId,
      patientId,
      appointmentId,
      user.id,
      visitDate,
      complaint,
      text(formData, "vitals"),
      text(formData, "exam"),
      diagnosis,
      text(formData, "treatment"),
      text(formData, "recommendations"),
      text(formData, "followUp"),
      fee,
      discount,
      formData.get("shared") ? 1 : 1,
      nowIso(),
    ],
  );

  if (appointmentId) {
    run("UPDATE appointments SET status = 'done' WHERE id = ? AND clinic_id = ?", [appointmentId, user.clinicId]);
  }
  run("INSERT INTO notifications (id, clinic_id, user_id, title, body, kind, created_at) VALUES (?,?,?,?,?,?,?)", [
    newId(),
    user.clinicId,
    null,
    "زيارة مكتملة",
    `${patient.name} — ${diagnosis}`,
    "info",
    nowIso(),
  ]);

  revalidateVisit(patientId);
  redirect(`/visits/${id}`);
}

export async function updateVisit(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const id = text(formData, "id");
  const visit = get<{ patient_id: string }>("SELECT patient_id FROM visits WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!visit) return { error: "الزيارة غير موجودة" };

  const fee = Math.max(0, Number(formData.get("fee") ?? 0) || 0);
  const discount = Math.max(0, Number(formData.get("discount") ?? 0) || 0);

  run(
    `UPDATE visits SET complaint = ?, vitals = ?, exam = ?, diagnosis = ?, treatment = ?, recommendations = ?,
       follow_up = ?, fee = ?, discount = ?, shared = ? WHERE id = ? AND clinic_id = ?`,
    [
      text(formData, "complaint"),
      text(formData, "vitals"),
      text(formData, "exam"),
      text(formData, "diagnosis"),
      text(formData, "treatment"),
      text(formData, "recommendations"),
      text(formData, "followUp"),
      fee,
      discount,
      formData.get("shared") ? 1 : 0,
      id,
      user.clinicId,
    ],
  );
  revalidateVisit(visit.patient_id);
  revalidatePath(`/visits/${id}`);
  return { ok: true };
}

export async function addPrescription(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const visitId = text(formData, "visitId");
  const visit = get<{ patient_id: string }>("SELECT patient_id FROM visits WHERE id = ? AND clinic_id = ?", [visitId, user.clinicId]);
  if (!visit) return { error: "الزيارة غير موجودة" };

  const drugs = formData.getAll("drug").map(String);
  const doses = formData.getAll("dose").map(String);
  const frequencies = formData.getAll("frequency").map(String);
  const durations = formData.getAll("duration").map(String);

  const items = drugs
    .map((drug, index) => ({
      drug: drug.trim(),
      dose: (doses[index] ?? "").trim(),
      frequency: (frequencies[index] ?? "").trim(),
      duration: (durations[index] ?? "").trim(),
    }))
    .filter((item) => item.drug.length > 0);

  if (items.length === 0) return { error: "أضف دواءً واحداً على الأقل" };

  run("INSERT INTO prescriptions (id, clinic_id, patient_id, visit_id, doctor_id, items, instructions, created_at) VALUES (?,?,?,?,?,?,?,?)", [
    newId(),
    user.clinicId,
    visit.patient_id,
    visitId,
    user.id,
    JSON.stringify(items),
    text(formData, "instructions"),
    nowIso(),
  ]);

  revalidateVisit(visit.patient_id);
  revalidatePath(`/visits/${visitId}`);
  return { ok: true };
}

export async function deletePrescription(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const row = get<{ patient_id: string; visit_id: string | null }>(
    "SELECT patient_id, visit_id FROM prescriptions WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!row) return;
  run("DELETE FROM prescriptions WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  revalidateVisit(row.patient_id);
  if (row.visit_id) revalidatePath(`/visits/${row.visit_id}`);
}
