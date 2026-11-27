"use server";

import { revalidatePath } from "next/cache";
import { requireClinicUser } from "@/lib/auth";
import { get, all, run, tx, newId, nowIso } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "./appointments";

export async function updateClinic(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const currency = String(formData.get("currency") ?? "SYP").trim().toUpperCase().slice(0, 3);
  if (name.length < 2) return { error: "أدخل اسم العيادة" };

  await run("UPDATE clinics SET name = ?, phone = ?, address = ?, currency = ? WHERE id = ?", [name, phone, address, currency, user.clinicId]);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "secretary");
  const specialty = String(formData.get("specialty") ?? "").trim();

  if (name.length < 2) return { error: "أدخل اسم الموظف" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "أدخل بريداً إلكترونياً صحيحاً" };
  if (password.length < 6) return { error: "كلمة المرور 6 أحرف على الأقل" };
  if (!["doctor", "secretary"].includes(role)) return { error: "صلاحية غير صالحة" };

  const existing = await get<{ id: string }>("SELECT id FROM users WHERE lower(email) = ?", [email]);
  if (existing) return { error: "البريد مستخدم مسبقاً" };

  await run("INSERT INTO users (id, clinic_id, name, email, password_hash, role, specialty, created_at) VALUES (?,?,?,?,?,?,?,?)", [
    newId(),
    user.clinicId,
    name,
    email,
    hashPassword(password),
    role,
    role === "doctor" ? specialty : "",
    nowIso(),
  ]);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "أدخل اسم الموظف" };
  const staff = await get<{ id: string; role: string }>("SELECT id, role FROM users WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!staff) return { error: "المستخدم غير موجود" };
  if (password && password.length < 6) return { error: "كلمة المرور 6 أحرف على الأقل" };

  await run(
    staff.role === "doctor"
      ? "UPDATE users SET name = ?, specialty = ? WHERE id = ? AND clinic_id = ?"
      : "UPDATE users SET name = ?, specialty = '' WHERE id = ? AND clinic_id = ?",
    staff.role === "doctor" ? [name, specialty, id, user.clinicId] : [name, id, user.clinicId],
  );
  if (password) await run("UPDATE users SET password_hash = ? WHERE id = ? AND clinic_id = ?", [hashPassword(password), id, user.clinicId]);
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "staff.update", entity: "user", entityId: id, details: name });
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteStaff(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  if (id === user.id) return;
  const staff = await get<{ id: string; role: string; name: string }>("SELECT id, role, name FROM users WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!staff) return;

  const [{ n: openAppointments } = { n: 0 }] = await all<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND status = 'booked'", [id, user.clinicId]);
  if (openAppointments > 0) return;

  await tx(async ({ run: txRun }) => {
    await txRun("DELETE FROM sessions WHERE user_id = ?", [id]);
    await txRun("DELETE FROM notifications WHERE user_id = ?", [id]);
    await txRun("DELETE FROM users WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  });
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "staff.delete", entity: "user", entityId: id, details: `${staff.role}:${staff.name}` });
  revalidatePath("/settings");
}

export async function toggleStaff(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const staff = await get<{ id: string; role: string; active: number }>("SELECT id, role, active FROM users WHERE id = ? AND clinic_id = ?", [
    id,
    user.clinicId,
  ]);
  if (!staff || staff.id === user.id) return;
  await run("UPDATE users SET active = ? WHERE id = ? AND clinic_id = ?", [staff.active ? 0 : 1, id, user.clinicId]);
  await logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: staff.active ? "staff.deactivate" : "staff.activate", entity: "user", entityId: id, details: staff.role });
  revalidatePath("/settings");
}

const SECRETARY_PERMS = ["appointments", "patients", "finance", "reports", "uploads"] as const;

export async function togglePerm(formData: FormData) {
  const doctor = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const perm = String(formData.get("perm") ?? "");
  if (!SECRETARY_PERMS.includes(perm as (typeof SECRETARY_PERMS)[number])) return;
  const staff = await get<{ id: string; role: string; denied_perms: string }>("SELECT id, role, denied_perms FROM users WHERE id = ? AND clinic_id = ?", [
    id,
    doctor.clinicId,
  ]);
  if (!staff || staff.role !== "secretary") return;
  const denied = new Set(staff.denied_perms.split(",").filter(Boolean));
  if (denied.has(perm)) denied.delete(perm);
  else denied.add(perm);
  await run("UPDATE users SET denied_perms = ? WHERE id = ? AND clinic_id = ?", [[...denied].join(","), id, doctor.clinicId]);
  await logAudit({ clinicId: doctor.clinicId, userId: doctor.id, userName: doctor.name, action: "staff.perm", entity: "user", entityId: id, details: `${perm}:${!denied.has(perm) ? "منح" : "سحب"}` });
  revalidatePath("/settings");
}

export async function addCurrency(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 3);
  const rate = Number(formData.get("rate") ?? 0);

  if (!/^[A-Z]{3}$/.test(code)) return { error: "اختر عملة صحيحة" };
  if (code === user.currency) return { error: "هذه عملة العيادة الأساسية" };
  if (!Number.isFinite(rate) || rate <= 0) return { error: "أدخل سعر صرف أكبر من صفر" };
  if (rate > 100_000) return { error: "سعر الصرف أكبر من الحد المسموح" };

  await run(
    "INSERT INTO clinic_currencies (clinic_id, code, rate, created_at) VALUES (?,?,?,?) ON CONFLICT(clinic_id, code) DO UPDATE SET rate = excluded.rate",
    [user.clinicId, code, rate, nowIso()],
  );
  revalidatePath("/settings");
  revalidatePath("/finance");
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteCurrency(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  await run("DELETE FROM clinic_currencies WHERE clinic_id = ? AND code = ?", [user.clinicId, code]);
  revalidatePath("/settings");
  revalidatePath("/finance");
  revalidatePath("/reports");
}
