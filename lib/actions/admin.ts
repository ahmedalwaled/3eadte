"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { get, run, newId, nowIso, tx } from "@/lib/db";
import type { ActionResult } from "./appointments";

export async function createClinic(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const currency = String(formData.get("currency") ?? "SAR").trim().toUpperCase().slice(0, 3);
  const doctorName = String(formData.get("doctorName") ?? "").trim();
  const doctorEmail = String(formData.get("doctorEmail") ?? "").trim().toLowerCase();
  const doctorPassword = String(formData.get("doctorPassword") ?? "");
  const specialty = String(formData.get("specialty") ?? "").trim();

  if (name.length < 2) return { error: "أدخل اسم العيادة" };
  if (doctorName.length < 2) return { error: "أدخل اسم الطبيب المسؤول" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doctorEmail)) return { error: "بريد الطبيب غير صحيح" };
  if (doctorPassword.length < 6) return { error: "كلمة المرور 6 أحرف على الأقل" };
  if (get("SELECT id FROM users WHERE lower(email) = ?", [doctorEmail])) return { error: "البريد مستخدم مسبقاً" };

  const clinicId = newId();
  tx(() => {
    run("INSERT INTO clinics (id, name, phone, address, currency, created_at) VALUES (?,?,?,?,?,?)", [
      clinicId,
      name,
      phone,
      address,
      currency,
      nowIso(),
    ]);
    run("INSERT INTO users (id, clinic_id, name, email, password_hash, role, specialty, created_at) VALUES (?,?,?,?,?,?,?,?)", [
      newId(),
      clinicId,
      doctorName,
      doctorEmail,
      hashPassword(doctorPassword),
      "doctor",
      specialty,
      nowIso(),
    ]);
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function toggleClinic(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const clinic = get<{ active: number }>("SELECT active FROM clinics WHERE id = ?", [id]);
  if (!clinic) return;
  run("UPDATE clinics SET active = ? WHERE id = ?", [clinic.active ? 0 : 1, id]);
  revalidatePath("/admin");
}
