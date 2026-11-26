import crypto from "node:crypto";

export function portalCookieName(token: string): string {
  return `portal_${crypto.createHash("sha256").update(token).digest("hex").slice(0, 24)}`;
}

export function portalCookieValue(patientId: string, token: string): string {
  return crypto.createHash("sha256").update(`ok:${patientId}:${token}`).digest("hex");
}
