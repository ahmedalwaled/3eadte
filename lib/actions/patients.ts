"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import { requireClinicUser, can } from "@/lib/auth";
import { get, run, newId, nowIso, tx, uploadsDir } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "./appointments";

function revalidatePatient(id?: string) {
  revalidatePath("/patients");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/patients/${id}`);
}

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function createPatient(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor", "secretary"]);
  const name = clean(formData.get("name"));
  const phone = clean(formData.get("phone"));
  if (name.length < 2) return { error: "أدخل اسم المريض كاملاً" };
  if (!/^[0-9+\s-]{6,}$/.test(phone)) return { error: "أدخل رقم جوال صحيح" };

  const count = Number((await get<{ n: number }>("SELECT COUNT(*) AS n FROM patients WHERE clinic_id = ?", [user.clinicId]))?.n ?? 0);
  const id = newId();
  await run(
    `INSERT INTO patients (id, clinic_id, code, name, phone, gender, birth_date, address, notes, portal_token, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      user.clinicId,
      `P-${String(count + 1).padStart(4, "0")}`,
      name,
      phone,
      clean(formData.get("gender")) === "female" ? "female" : "male",
      clean(formData.get("birthDate")),
      clean(formData.get("address")),
      clean(formData.get("notes")),
      newId().replace(/-/g, "").slice(0, 16),
      nowIso(),
    ],
  );
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "patient.create", entity: "patient", entityId: id, details: name });
  revalidatePatient(id);
  redirect(`/patients/${id}`);
}

export async function updatePatient(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor", "secretary"]);
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const phone = clean(formData.get("phone"));
  const exists = await get<{ id: string }>("SELECT id FROM patients WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!exists) return { error: "المريض غير موجود" };
  if (name.length < 2) return { error: "أدخل اسم المريض كاملاً" };

  await run(
    "UPDATE patients SET name = ?, phone = ?, gender = ?, birth_date = ?, address = ?, notes = ? WHERE id = ? AND clinic_id = ?",
    [
      name,
      phone,
      clean(formData.get("gender")) === "female" ? "female" : "male",
      clean(formData.get("birthDate")),
      clean(formData.get("address")),
      clean(formData.get("notes")),
      id,
      user.clinicId,
    ],
  );
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "patient.update", entity: "patient", entityId: id, details: name });
  revalidatePatient(id);
  redirect(`/patients/${id}`);
}

export async function deletePatient(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = clean(formData.get("id"));
  const exists = await get<{ id: string }>("SELECT id FROM patients WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!exists) return;
  await tx(async ({ run: txRun }) => {
    await txRun("DELETE FROM attachments WHERE patient_id = ? AND clinic_id = ?", [id, user.clinicId]);
    await txRun("DELETE FROM prescriptions WHERE patient_id = ? AND clinic_id = ?", [id, user.clinicId]);
    await txRun("DELETE FROM payments WHERE patient_id = ? AND clinic_id = ?", [id, user.clinicId]);
    await txRun("DELETE FROM visits WHERE patient_id = ? AND clinic_id = ?", [id, user.clinicId]);
    await txRun("DELETE FROM appointments WHERE patient_id = ? AND clinic_id = ?", [id, user.clinicId]);
    await txRun("DELETE FROM patients WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  });
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "patient.delete", entity: "patient", entityId: id, details: "حذف مريض وجميع سجلاته" });
  revalidatePath("/patients");
  redirect("/patients");
}

export async function uploadAttachment(formData: FormData) {
  const user = await requireClinicUser(["doctor", "secretary"]);
  if (!can(user, "uploads")) return;
  const patientId = clean(formData.get("patientId"));
  const patient = await get<{ id: string }>("SELECT id FROM patients WHERE id = ? AND clinic_id = ?", [patientId, user.clinicId]);
  if (!patient) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 10 * 1024 * 1024) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_").slice(-120);
  const ext = path.extname(file.name).toLowerCase();
  const stored = `${newId()}${ext}`;
  await fs.writeFile(path.join(uploadsDir(), stored), buffer);

  await run(
    "INSERT INTO attachments (id, clinic_id, patient_id, visit_id, stored_name, original_name, mime, size, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      newId(),
      user.clinicId,
      patientId,
      clean(formData.get("visitId")) || null,
      stored,
      safeName,
      file.type || "application/octet-stream",
      file.size,
      nowIso(),
    ],
  );
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "attachment.upload", entity: "attachment", entityId: patientId, details: safeName });
  revalidatePatient(patientId);
}

export async function deleteAttachment(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = clean(formData.get("id"));
  const row = await get<{ stored_name: string; patient_id: string }>(
    "SELECT stored_name, patient_id FROM attachments WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!row) return;
  await run("DELETE FROM attachments WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  await fs.unlink(path.join(uploadsDir(), row.stored_name)).catch(() => undefined);
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "attachment.delete", entity: "attachment", entityId: row.patient_id, details: row.stored_name });
  revalidatePatient(row.patient_id);
}

export async function toggleAttachmentShare(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = clean(formData.get("id"));
  const row = await get<{ patient_id: string; share_with_portal: number }>(
    "SELECT patient_id, share_with_portal FROM attachments WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!row) return;
  await run("UPDATE attachments SET share_with_portal = ? WHERE id = ? AND clinic_id = ?", [row.share_with_portal ? 0 : 1, id, user.clinicId]);
  await logAudit({
    clinicId: user.clinicId,
    userId: user.id,
    userName: user.name,
    action: row.share_with_portal ? "attachment.unshare" : "attachment.share",
    entity: "attachment",
    entityId: id,
  });
  revalidatePatient(row.patient_id);
}
