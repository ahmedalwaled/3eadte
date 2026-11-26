"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { get } from "@/lib/db";
import { portalCookieName, portalCookieValue } from "@/lib/portal";

export type PortalState = { error?: string };

export async function verifyPortal(_prev: PortalState | null, formData: FormData): Promise<PortalState> {
  const token = String(formData.get("token") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");

  if (!token) return { error: "رابط غير صالح" };
  if (phone.length < 6) return { error: "أدخل رقم الجوال المسجل في العيادة" };

  const patient = await get<{ id: string; phone: string }>("SELECT id, phone FROM patients WHERE portal_token = ?", [token]);
  if (!patient) return { error: "الرابط غير صحيح أو تم إيقافه" };

  const registered = String(patient.phone ?? "").replace(/\D/g, "");
  const ok = registered.length >= 6 && (registered === phone || registered.slice(-7) === phone.slice(-7));
  if (!ok) return { error: "رقم الجوال لا يطابق بيانات الملف" };

  const store = await cookies();
  store.set(portalCookieName(token), portalCookieValue(patient.id, token), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 12,
  });
  revalidatePath(`/portal/${token}`);
  return {};
}

export async function portalLogout(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const store = await cookies();
  store.delete(portalCookieName(token));
  revalidatePath(`/portal/${token}`);
}
