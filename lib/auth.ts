import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { get, run, newId, nowIso } from "./db";

export type Role = "platform_admin" | "doctor" | "secretary";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
  clinicName: string | null;
  currency: string;
  specialty: string;
  deniedPerms: string[];
}

/** Granular permissions a clinic may withhold from secretaries. Doctors always have them. */
export type Perm = "finance" | "reports" | "uploads";

export function can(user: CurrentUser, perm: Perm): boolean {
  if (user.role === "doctor" || user.role === "platform_admin") return true;
  return !user.deniedPerms.includes(perm);
}

const COOKIE = "clinic_session";
const DAY_MS = 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string): Promise<string> {
  const id = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * DAY_MS).toISOString();
  await run("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [
    id,
    userId,
    expires,
    nowIso(),
  ]);
  return id;
}

export async function setSessionCookie(sessionId: string) {
  const store = await cookies();
  // Secure only when the request actually arrived over HTTPS: the app is reached
  // through a preview host that may serve plain HTTP, where browsers drop
  // Secure cookies and every navigation bounces back to /login.
  const proto = (await headers()).get("x-forwarded-proto") ?? "http";
  store.set(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: proto === "https",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) await run("DELETE FROM sessions WHERE id = ?", [id]);
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE)?.value;
  if (!sessionId) return null;
  const row = await get<Record<string, string | null>>(
    `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.specialty, u.active, u.denied_perms, c.name AS clinic_name,
            c.currency, c.active AS clinic_active, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN clinics c ON c.id = u.clinic_id
      WHERE s.id = ?`,
    [sessionId],
  );
  if (!row) return null;
  if (!row.expires_at || new Date(String(row.expires_at)) < new Date()) {
    await run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    return null;
  }
  if (!row.active || (row.clinic_id && !row.clinic_active)) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    clinicId: row.clinic_id ?? null,
    clinicName: row.clinic_name ?? null,
    currency: row.currency ?? "SAR",
    specialty: row.specialty ?? "",
    deniedPerms: String(row.denied_perms ?? "").split(",").filter(Boolean),
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Clinics-scoped user: every query must filter by user.clinicId. */
export async function requireClinicUser(roles?: Role[]): Promise<CurrentUser & { clinicId: string }> {
  const user = await requireUser();
  if (!user.clinicId) redirect("/admin");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user as CurrentUser & { clinicId: string };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "platform_admin") redirect("/dashboard");
  return user;
}
