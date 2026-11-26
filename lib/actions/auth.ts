"use server";

import { redirect } from "next/navigation";
import { get } from "../db";
import { verifyPassword, createSession, setSessionCookie, clearSession } from "../auth";
import { ensureSeed } from "../seed";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  ensureSeed();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور" };

  const user = get<{ id: string; password_hash: string; role: string; active: number }>(
    "SELECT id, password_hash, role, active FROM users WHERE lower(email) = ?",
    [email],
  );

  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  const sessionId = createSession(user.id);
  await setSessionCookie(sessionId);
  redirect(user.role === "platform_admin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
