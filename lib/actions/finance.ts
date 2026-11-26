"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClinicUser, can } from "@/lib/auth";
import { get, run, newId, nowIso } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "./appointments";

const METHODS = ["cash", "card", "transfer", "insurance"];

function revalidateFinance(patientId?: string) {
  revalidatePath("/finance");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  revalidatePath("/patients");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

/**
 * Resolve the currency a payment/expense was entered in against the clinic base currency.
 * Returns the code and the snapshot rate (base units per 1 unit) used for every total.
 */
function resolveCurrency(clinicId: string, base: string, requested: string): { code: string; rate: number } | null {
  const code = requested.trim().toUpperCase().slice(0, 3);
  if (!code || code === base) return { code: base, rate: 1 };
  const row = get<{ rate: number }>("SELECT rate FROM clinic_currencies WHERE clinic_id = ? AND code = ?", [clinicId, code]);
  const rate = Number(row?.rate ?? 0);
  if (!(rate > 0)) return null;
  return { code, rate };
}

export async function addPayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor", "secretary"]);
  if (!can(user, "finance")) return { error: "لا تملك صلاحية تسجيل المدفوعات" };
  const patientId = String(formData.get("patientId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash");
  const note = String(formData.get("note") ?? "").trim();
  const visitId = String(formData.get("visitId") ?? "").trim() || null;
  const dateValue = String(formData.get("paidAt") ?? "").trim();

  if (!patientId) return { error: "حدد المريض" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "أدخل مبلغاً صحيحاً أكبر من صفر" };

  const currency = resolveCurrency(user.clinicId, user.currency, String(formData.get("currency") ?? ""));
  if (!currency) return { error: "العملة المختارة غير مهيّأة في الإعدادات" };
  if (amount > 1_000_000 / currency.rate) return { error: "المبلغ أكبر من الحد المسموح" };

  const patient = get<{ id: string }>("SELECT id FROM patients WHERE id = ? AND clinic_id = ?", [patientId, user.clinicId]);
  if (!patient) return { error: "المريض غير موجود في هذه العيادة" };

  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T10:00` : nowIso().slice(0, 16);

  run(
    "INSERT INTO payments (id, clinic_id, patient_id, visit_id, amount, currency, rate, method, note, paid_at, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      newId(),
      user.clinicId,
      patientId,
      visitId,
      amount,
      currency.code,
      currency.rate,
      METHODS.includes(method) ? method : "cash",
      note,
      paidAt,
      user.id,
      nowIso(),
    ],
  );
  logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "payment.create", entity: "payment", entityId: patientId, details: `${amount} ${currency.code}` });

  revalidateFinance(patientId);
  if (formData.get("backTo")) redirect(String(formData.get("backTo")));
  return { ok: true };
}

export async function deletePayment(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  const row = get<{ patient_id: string }>("SELECT patient_id FROM payments WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  if (!row) return;
  run("DELETE FROM payments WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "payment.delete", entity: "payment", entityId: row.patient_id });
  revalidateFinance(row.patient_id);
}

export async function addExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireClinicUser(["doctor", "secretary"]);
  if (!can(user, "finance")) return { error: "لا تملك صلاحية تسجيل المصروفات" };
  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "general");
  const dateValue = String(formData.get("spentAt") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (title.length < 2) return { error: "أدخل وصفاً للمصروف" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "أدخل مبلغاً صحيحاً" };

  const currency = resolveCurrency(user.clinicId, user.currency, String(formData.get("currency") ?? ""));
  if (!currency) return { error: "العملة المختارة غير مهيّأة في الإعدادات" };
  if (amount > 1_000_000 / currency.rate) return { error: "المبلغ أكبر من الحد المسموح" };

  const spentAt = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T12:00` : nowIso().slice(0, 16);

  run(
    "INSERT INTO expenses (id, clinic_id, title, amount, currency, rate, category, spent_at, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [newId(), user.clinicId, title, amount, currency.code, currency.rate, category, spentAt, note, user.id, nowIso()],
  );
  logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "expense.create", entity: "expense", entityId: title, details: `${amount} ${currency.code}` });
  revalidateFinance();
  return { ok: true };
}

export async function deleteExpense(formData: FormData) {
  const user = await requireClinicUser(["doctor"]);
  const id = String(formData.get("id") ?? "");
  run("DELETE FROM expenses WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  logAudit({ clinicId: user.clinicId, userId: user.id, userName: user.name, action: "expense.delete", entity: "expense", entityId: id });
  revalidateFinance();
}
