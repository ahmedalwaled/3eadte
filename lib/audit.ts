import "server-only";
import { run, newId, nowIso } from "./db";

/** Append an audit trail entry; failures must never break the user's action. */
export async function logAudit(input: {
  clinicId?: string | null;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await run(
      "INSERT INTO audit_logs (id, clinic_id, user_id, user_name, action, entity, entity_id, details, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        newId(),
        input.clinicId ?? null,
        input.userId ?? null,
        input.userName ?? "",
        input.action,
        input.entity ?? "",
        input.entityId ?? "",
        input.details ?? "",
        nowIso(),
      ],
    );
  } catch {
    // Auditing is best-effort: the primary action already succeeded.
  }
}
