import "server-only";
import { all, get } from "./db";

export type AppointmentRow = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  starts_at: string;
  duration: number;
  status: string;
  reason: string;
  doctor_id: string;
  doctor_name: string;
  visit_id: string | null;
};

export type PatientRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  gender: string;
  birth_date: string;
  address: string;
  notes: string;
  portal_token: string;
  created_at: string;
  last_visit: string | null;
  visits_count: number;
  balance: number;
};

const APPT_SELECT = `
  SELECT a.id, a.patient_id, p.name AS patient_name, p.phone AS patient_phone, a.starts_at,
         a.duration, a.status, a.reason, a.doctor_id, u.name AS doctor_name,
         (SELECT v.id FROM visits v WHERE v.appointment_id = a.id LIMIT 1) AS visit_id
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN users u ON u.id = a.doctor_id
`;

export function appointmentsOnDate(clinicId: string, date: string): AppointmentRow[] {
  return all<AppointmentRow>(`${APPT_SELECT} WHERE a.clinic_id = ? AND substr(a.starts_at, 1, 10) = ? ORDER BY a.starts_at`, [
    clinicId,
    date,
  ]);
}

export function appointmentsInRange(clinicId: string, from: string, to: string): AppointmentRow[] {
  return all<AppointmentRow>(
    `${APPT_SELECT} WHERE a.clinic_id = ? AND substr(a.starts_at, 1, 10) BETWEEN ? AND ? ORDER BY a.starts_at`,
    [clinicId, from, to],
  );
}

export function appointmentById(clinicId: string, id: string): AppointmentRow | undefined {
  return get<AppointmentRow>(`${APPT_SELECT} WHERE a.clinic_id = ? AND a.id = ?`, [clinicId, id]);
}

export function doctorIdFor(clinicId: string): string | undefined {
  return get<{ id: string }>("SELECT id FROM users WHERE clinic_id = ? AND role = 'doctor' AND active = 1 ORDER BY created_at LIMIT 1", [
    clinicId,
  ])?.id;
}

export function doctorsFor(clinicId: string) {
  return all<{ id: string; name: string; specialty: string }>(
    "SELECT id, name, specialty FROM users WHERE clinic_id = ? AND role = 'doctor' AND active = 1 ORDER BY name",
    [clinicId],
  );
}

export function findConflict(
  clinicId: string,
  doctorId: string,
  startsAt: string,
  duration: number,
  excludeId?: string,
) {
  const start = new Date(startsAt).getTime();
  const end = start + duration * 60000;
  const rows = all<{ id: string; starts_at: string; duration: number; patient_name: string; status: string }>(
    `SELECT a.id, a.starts_at, a.duration, p.name AS patient_name, a.status
       FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.clinic_id = ? AND a.doctor_id = ? AND a.status NOT IN ('cancelled', 'no_show')
        AND substr(a.starts_at, 1, 10) = ?`,
    [clinicId, doctorId, startsAt.slice(0, 10)],
  );
  return rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    const otherStart = new Date(row.starts_at).getTime();
    const otherEnd = otherStart + row.duration * 60000;
    return start < otherEnd && otherStart < end;
  });
}

export function patientList(clinicId: string, search = "", limit = 200): PatientRow[] {
  const q = `%${search.trim()}%`;
  return all<PatientRow>(
    `SELECT p.*,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit,
            (SELECT COUNT(*) FROM visits v WHERE v.patient_id = p.id) AS visits_count,
            COALESCE((SELECT SUM(v.fee - v.discount) FROM visits v WHERE v.patient_id = p.id), 0)
              - COALESCE((SELECT SUM(pay.amount * COALESCE(pay.rate, 1)) FROM payments pay WHERE pay.patient_id = p.id), 0) AS balance
       FROM patients p
      WHERE p.clinic_id = ? AND (? = '%%' OR p.name LIKE ? OR p.phone LIKE ? OR p.code LIKE ?)
      ORDER BY p.created_at DESC LIMIT ?`,
    [clinicId, q, q, q, q, limit],
  );
}

export function patientById(clinicId: string, id: string): PatientRow | undefined {
  return get<PatientRow>(
    `SELECT p.*,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit,
            (SELECT COUNT(*) FROM visits v WHERE v.patient_id = p.id) AS visits_count,
            COALESCE((SELECT SUM(v.fee - v.discount) FROM visits v WHERE v.patient_id = p.id), 0)
              - COALESCE((SELECT SUM(pay.amount * COALESCE(pay.rate, 1)) FROM payments pay WHERE pay.patient_id = p.id), 0) AS balance
       FROM patients p WHERE p.clinic_id = ? AND p.id = ?`,
    [clinicId, id],
  );
}

export type VisitRow = {
  id: string;
  visit_date: string;
  complaint: string;
  vitals: string;
  exam: string;
  diagnosis: string;
  treatment: string;
  recommendations: string;
  follow_up: string;
  fee: number;
  discount: number;
  shared: number;
  doctor_name: string;
};

export function visitsForPatient(clinicId: string, patientId: string): VisitRow[] {
  return all<VisitRow>(
    `SELECT v.*, u.name AS doctor_name FROM visits v JOIN users u ON u.id = v.doctor_id
      WHERE v.clinic_id = ? AND v.patient_id = ? ORDER BY v.visit_date DESC`,
    [clinicId, patientId],
  );
}

export function visitById(clinicId: string, id: string) {
  return get<VisitRow & { patient_id: string; appointment_id: string | null; doctor_id: string }>(
    `SELECT v.*, u.name AS doctor_name FROM visits v JOIN users u ON u.id = v.doctor_id
      WHERE v.clinic_id = ? AND v.id = ?`,
    [clinicId, id],
  );
}

export type PrescriptionRow = {
  id: string;
  created_at: string;
  items: string;
  instructions: string;
  visit_id: string | null;
  doctor_name: string;
};

export function prescriptionsForPatient(clinicId: string, patientId: string): PrescriptionRow[] {
  return all<PrescriptionRow>(
    `SELECT pr.*, u.name AS doctor_name FROM prescriptions pr JOIN users u ON u.id = pr.doctor_id
      WHERE pr.clinic_id = ? AND pr.patient_id = ? ORDER BY pr.created_at DESC`,
    [clinicId, patientId],
  );
}

export function prescriptionById(clinicId: string, id: string) {
  return get<PrescriptionRow & { patient_id: string }>(
    `SELECT pr.*, u.name AS doctor_name FROM prescriptions pr JOIN users u ON u.id = pr.doctor_id
      WHERE pr.clinic_id = ? AND pr.id = ?`,
    [clinicId, id],
  );
}

export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  rate: number;
  method: string;
  note: string;
  paid_at: string;
  patient_id: string;
  patient_name: string;
};

export function paymentsForPatient(clinicId: string, patientId: string): PaymentRow[] {
  return all<PaymentRow>(
    `SELECT pay.*, COALESCE(pay.rate, 1) AS rate, p.name AS patient_name FROM payments pay JOIN patients p ON p.id = pay.patient_id
      WHERE pay.clinic_id = ? AND pay.patient_id = ? ORDER BY pay.paid_at DESC`,
    [clinicId, patientId],
  );
}

export function paymentsInRange(clinicId: string, from: string, to: string): PaymentRow[] {
  return all<PaymentRow>(
    `SELECT pay.*, COALESCE(pay.rate, 1) AS rate, p.name AS patient_name FROM payments pay JOIN patients p ON p.id = pay.patient_id
      WHERE pay.clinic_id = ? AND substr(pay.paid_at, 1, 10) BETWEEN ? AND ? ORDER BY pay.paid_at DESC`,
    [clinicId, from, to],
  );
}

export function expensesInRange(clinicId: string, from: string, to: string) {
  return all<{ id: string; title: string; amount: number; currency: string; rate: number; category: string; spent_at: string; note: string }>(
    `SELECT *, COALESCE(rate, 1) AS rate FROM expenses WHERE clinic_id = ? AND substr(spent_at, 1, 10) BETWEEN ? AND ? ORDER BY spent_at DESC`,
    [clinicId, from, to],
  );
}

export function totalsInRange(clinicId: string, from: string, to: string) {
  const paid = Number(
    get<{ total: number }>(
      "SELECT COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total FROM payments WHERE clinic_id = ? AND substr(paid_at, 1, 10) BETWEEN ? AND ?",
      [clinicId, from, to],
    )?.total ?? 0,
  );
  const spent = Number(
    get<{ total: number }>(
      "SELECT COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total FROM expenses WHERE clinic_id = ? AND substr(spent_at, 1, 10) BETWEEN ? AND ?",
      [clinicId, from, to],
    )?.total ?? 0,
  );
  const due = Number(
    get<{ total: number }>(
      `SELECT COALESCE(SUM(fee - discount), 0) AS total FROM visits WHERE clinic_id = ? AND substr(visit_date, 1, 10) BETWEEN ? AND ?`,
      [clinicId, from, to],
    )?.total ?? 0,
  );
  return { paid, spent, due, net: paid - spent };
}

export function clinicBalances(clinicId: string) {
  const due = Number(
    get<{ total: number }>("SELECT COALESCE(SUM(fee - discount), 0) AS total FROM visits WHERE clinic_id = ?", [clinicId])?.total ?? 0,
  );
  const paid = Number(
    get<{ total: number }>("SELECT COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total FROM payments WHERE clinic_id = ?", [clinicId])?.total ?? 0,
  );
  return { due, paid, outstanding: Math.max(0, due - paid) };
}

export function patientBalance(clinicId: string, patientId: string) {
  const due = Number(
    get<{ total: number }>("SELECT COALESCE(SUM(fee - discount), 0) AS total FROM visits WHERE clinic_id = ? AND patient_id = ?", [
      clinicId,
      patientId,
    ])?.total ?? 0,
  );
  const paid = Number(
    get<{ total: number }>("SELECT COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total FROM payments WHERE clinic_id = ? AND patient_id = ?", [
      clinicId,
      patientId,
    ])?.total ?? 0,
  );
  return { due, paid, outstanding: Math.max(0, due - paid) };
}

export type ClinicCurrencyRow = { code: string; rate: number };

/** Currencies a clinic accepts besides its base currency, with the rate to the base currency. */
export function clinicCurrencies(clinicId: string): ClinicCurrencyRow[] {
  return all<ClinicCurrencyRow>("SELECT code, rate FROM clinic_currencies WHERE clinic_id = ? ORDER BY code", [clinicId]);
}

/** Payments in a range grouped by the currency they were entered in, with base-currency equivalents. */
export function paymentsByCurrency(clinicId: string, base: string, from: string, to: string) {
  return all<{ currency: string; count: number; amount: number; base: number }>(
    `SELECT COALESCE(NULLIF(currency, ''), ?) AS currency,
            COUNT(*) AS count,
            COALESCE(SUM(amount), 0) AS amount,
            COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS base
       FROM payments
      WHERE clinic_id = ? AND substr(paid_at, 1, 10) BETWEEN ? AND ?
      GROUP BY currency
      ORDER BY base DESC`,
    [base, clinicId, from, to],
  );
}

/** Ledger of payments for a patient, newest first, with the base-currency value of each one. */
export function paymentLedger(clinicId: string, patientId: string, base: string) {
  return all<{ id: string; amount: number; currency: string; rate: number; method: string; note: string; paid_at: string; patient_name: string }>(
    `SELECT pay.id, pay.amount, pay.currency, COALESCE(pay.rate, 1) AS rate, pay.method, pay.note, pay.paid_at, p.name AS patient_name
       FROM payments pay JOIN patients p ON p.id = pay.patient_id
      WHERE pay.clinic_id = ? AND pay.patient_id = ?
      ORDER BY pay.paid_at DESC`,
    [clinicId, patientId],
  ).map((row) => ({ ...row, currency: row.currency || base }));
}

export function dashboardStats(clinicId: string, date: string) {
  const today = appointmentsOnDate(clinicId, date);
  const counts: Record<string, number> = {};
  today.forEach((row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  });
  const patients = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM patients WHERE clinic_id = ?", [clinicId])?.n ?? 0);
  const visitsToday = Number(
    get<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE clinic_id = ? AND substr(visit_date, 1, 10) = ?", [clinicId, date])?.n ?? 0,
  );
  const revenueToday = Number(
    get<{ total: number }>(
      "SELECT COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total FROM payments WHERE clinic_id = ? AND substr(paid_at, 1, 10) = ?",
      [clinicId, date],
    )?.total ?? 0,
  );
  const outstanding = clinicBalances(clinicId).outstanding;
  return { today, counts, patients, visitsToday, revenueToday, outstanding };
}

export function revenueLastDays(clinicId: string, days = 7) {
  const rows = all<{ day: string; total: number }>(
    `SELECT substr(paid_at, 1, 10) AS day, COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total
       FROM payments WHERE clinic_id = ?
      GROUP BY day ORDER BY day DESC LIMIT ?`,
    [clinicId, days],
  );
  return rows.reverse();
}

export function upcomingAppointments(clinicId: string, fromIso: string, limit = 5) {
  return all<AppointmentRow>(`${APPT_SELECT} WHERE a.clinic_id = ? AND a.starts_at >= ? ORDER BY a.starts_at LIMIT ?`, [
    clinicId,
    fromIso,
    limit,
  ]);
}

export function notificationsFor(clinicId: string, limit = 20) {
  return all<{ id: string; title: string; body: string; kind: string; is_read: number; created_at: string }>(
    "SELECT * FROM notifications WHERE clinic_id = ? ORDER BY created_at DESC LIMIT ?",
    [clinicId, limit],
  );
}

export function unreadCount(clinicId: string) {
  return Number(
    get<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE clinic_id = ? AND is_read = 0", [clinicId])?.n ?? 0,
  );
}
