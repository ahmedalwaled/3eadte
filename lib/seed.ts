import "server-only";
import { get, newId, nowIso, tx } from "./db";
import { hashPassword } from "./auth";
import crypto from "node:crypto";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function at(offsetDays: number, time: string): string {
  return `${localDate(offsetDays)}T${time}`;
}

const VISIT_SQL =
  "INSERT INTO visits (id, clinic_id, patient_id, appointment_id, doctor_id, visit_date, complaint, vitals, exam, diagnosis, treatment, recommendations, follow_up, fee, discount, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

type Run = (query: string, params?: unknown[]) => Promise<void>;

type VisitInput = {
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  doctorId: string;
  visitDate: string;
  complaint: string;
  vitals: string;
  exam: string;
  diagnosis: string;
  treatment: string;
  recommendations: string;
  followUp: string;
  fee: number;
  discount: number;
};

async function insertVisit(run: Run, input: VisitInput): Promise<string> {
  const id = newId();
  await run(VISIT_SQL, [
    id,
    input.clinicId,
    input.patientId,
    input.appointmentId,
    input.doctorId,
    input.visitDate,
    input.complaint,
    input.vitals,
    input.exam,
    input.diagnosis,
    input.treatment,
    input.recommendations,
    input.followUp,
    input.fee,
    input.discount,
    nowIso(),
  ]);
  return id;
}

const PATIENT_SQL =
  "INSERT INTO patients (id, clinic_id, code, name, phone, gender, birth_date, address, notes, portal_token, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)";

const APPT_SQL =
  "INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, starts_at, duration, reason, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)";

const PAYMENT_SQL =
  "INSERT INTO payments (id, clinic_id, patient_id, visit_id, amount, method, note, paid_at, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)";

const PRESCRIPTION_SQL =
  "INSERT INTO prescriptions (id, clinic_id, patient_id, visit_id, doctor_id, items, instructions, created_at) VALUES (?,?,?,?,?,?,?,?)";

const USER_SQL =
  "INSERT INTO users (id, clinic_id, name, email, password_hash, role, specialty, created_at) VALUES (?,?,?,?,?,?,?,?)";

const CLINIC_SQL =
  "INSERT INTO clinics (id, name, phone, address, currency, created_at) VALUES (?,?,?,?,?,?)";

const NOTIFICATION_SQL =
  "INSERT INTO notifications (id, clinic_id, user_id, title, body, kind, created_at) VALUES (?,?,?,?,?,?,?)";

const EXPENSE_SQL =
  "INSERT INTO expenses (id, clinic_id, title, amount, category, spent_at, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)";

const PEOPLE: [string, string, string, string, string][] = [
  ["أحمد محمد الحلبي", "0933123456", "male", "1988-04-12", "دمشق - المزة"],
  ["نورة عبدالله العلي", "0933234567", "female", "1995-09-03", "دمشق - المزة"],
  ["سعد فهد الحمصي", "0933345678", "male", "1976-01-25", "حمص - الوعر"],
  ["هند سامي الدرويش", "0933456789", "female", "2001-06-18", "حلب - الشعار"],
  ["عبدالرحمن علي القاسم", "0933567890", "male", "1969-11-30", "دمشق - البرامكة"],
  ["لمى ناصر الأتاسي", "0933678901", "female", "2016-02-14", "حماة - الحاضر"],
  ["يوسف إبراهيم المخلوف", "0933789012", "male", "1992-07-07", "اللاذقية - الأمريكان"],
  ["ريم عبدالعزيز الحسيني", "0933890123", "female", "1983-12-21", "دمشق - كفرسوسة"],
  ["ماجد سليم النعيمي", "0933901234", "male", "1959-03-09", "دير الزور - الجورة"],
  ["دانة وليد الخوري", "0933012345", "female", "1999-10-05", "طرطوس - المشروع"],
];

let seeding: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = seed().catch((error) => {
      seeding = null;
      throw error;
    });
  }
  return seeding;
}

async function seed() {
  const existing = await get<{ n: number }>("SELECT COUNT(*) AS n FROM clinics");
  if (existing && Number(existing.n) > 0) return;

  const created = nowIso();
  const clinicA = newId();
  const clinicB = newId();
  const doctorA = newId();
  const secretaryA = newId();

  await tx(async ({ run }) => {
    await run(CLINIC_SQL, [clinicA, "عيادة النور الطبية", "0112345678", "دمشق - المزة", "SYP", created]);
    await run(CLINIC_SQL, [clinicB, "مركز الشفاء التخصصي", "0419876543", "حلب - الجميلية", "SYP", created]);

    await run(USER_SQL, [newId(), null, "مدير المنصة", "admin@platform.demo", hashPassword("admin123"), "platform_admin", "", created]);
    await run(USER_SQL, [doctorA, clinicA, "د. سارة الحلواني", "doctor@clinic.demo", hashPassword("doctor123"), "doctor", "طب الأسرة", created]);
    await run(USER_SQL, [secretaryA, clinicA, "منى الأتاسي", "secretary@clinic.demo", hashPassword("secret123"), "secretary", "", created]);
    await run(USER_SQL, [newId(), clinicB, "د. خالد بارودي", "doctor@shifa.demo", hashPassword("doctor123"), "doctor", "طب الأطفال", created]);

    const patientIds: string[] = [];
    for (const [index, person] of PEOPLE.entries()) {
      const id = newId();
      patientIds.push(id);
      const code = `P-${String(index + 1).padStart(4, "0")}`;
      await run(PATIENT_SQL, [
        id,
        clinicA,
        code,
        person[0],
        person[1],
        person[2],
        person[3],
        person[4],
        "",
        crypto.randomBytes(9).toString("base64url"),
        created,
      ]);
    }

    const addAppt = async (patientIdx: number, day: number, time: string, status: string, reason: string) => {
      const id = newId();
      await run(APPT_SQL, [id, clinicA, patientIds[patientIdx], doctorA, at(day, time), 20, reason, status, created]);
      return id;
    };

    const today1 = await addAppt(0, 0, "09:00", "done", "متابعة ضغط الدم");
    const today2 = await addAppt(1, 0, "09:30", "done", "صداع متكرر");
    await addAppt(2, 0, "10:00", "in_visit", "ألم أسفل الظهر");
    await addAppt(3, 0, "10:30", "waiting", "التهاب الحلق");
    await addAppt(4, 0, "11:00", "arrived", "متابعة سكري");
    await addAppt(5, 0, "11:30", "booked", "سعال وحرارة");
    await addAppt(6, 0, "12:00", "booked", "فحص دوري");
    await addAppt(7, 0, "16:00", "booked", "حساسية جلدية");
    await addAppt(8, -1, "09:00", "no_show", "مراجعة نتائج تحاليل");
    await addAppt(9, -1, "10:00", "done", "التهاب أذن");
    await addAppt(0, -1, "11:00", "cancelled", "استشارة تغذية");
    await addAppt(1, 1, "09:00", "booked", "متابعة صداع");
    await addAppt(3, 1, "09:30", "booked", "مراجعة نتائج");
    await addAppt(5, 2, "10:00", "booked", "تطعيم");
    await addAppt(2, 3, "17:00", "booked", "جلسة علاج طبيعي");

    const pastVisit = await insertVisit(run, {
      clinicId: clinicA,
      patientId: patientIds[9],
      appointmentId: null,
      doctorId: doctorA,
      visitDate: at(-1, "10:00"),
      complaint: "ألم بالأذن اليمنى مع حرارة منذ يومين",
      vitals: "الحرارة: 38.2 · النبض: 96 · الضغط: 118/76",
      exam: "احتقان بطبلة الأذن اليمنى دون إفرازات",
      diagnosis: "التهاب أذن وسطى حاد",
      treatment: "أموكسيسيلين 500 ملغ كل 8 ساعات لمدة 7 أيام",
      recommendations: "خافض حرارة عند اللزوم والمراجعة عند استمرار الحرارة",
      followUp: localDate(3),
      fee: 150,
      discount: 0,
    });
    await run(PRESCRIPTION_SQL, [
      newId(),
      clinicA,
      patientIds[9],
      pastVisit,
      doctorA,
      JSON.stringify([
        { drug: "أموكسيسيلين 500 ملغ", dose: "كبسولة", frequency: "3 مرات يومياً", duration: "7 أيام" },
        { drug: "باراسيتامول 500 ملغ", dose: "قرص", frequency: "عند اللزوم", duration: "3 أيام" },
      ]),
      "يؤخذ الدواء بعد الأكل والإكمال الكامل للمضاد الحيوي ضروري.",
      created,
    ]);
    await run(PAYMENT_SQL, [newId(), clinicA, patientIds[9], pastVisit, 100, "cash", "دفعة أولى", at(-1, "10:40"), secretaryA, created]);

    const visitA = await insertVisit(run, {
      clinicId: clinicA,
      patientId: patientIds[0],
      appointmentId: today1,
      doctorId: doctorA,
      visitDate: at(0, "09:00"),
      complaint: "متابعة دورية لضغط الدم",
      vitals: "الضغط: 132/84 · النبض: 78 · الوزن: 84 كغ",
      exam: "فحص القلب طبيعي ولا وذمة بالأطراف",
      diagnosis: "ارتفاع ضغط الدم - تحت السيطرة",
      treatment: "الاستمرار على لوسارتان 50 ملغ يومياً",
      recommendations: "تقليل الملح والمشي 30 دقيقة يومياً",
      followUp: localDate(30),
      fee: 150,
      discount: 25,
    });
    await run(PAYMENT_SQL, [newId(), clinicA, patientIds[0], visitA, 125, "card", "كشف كامل", at(0, "09:20"), secretaryA, created]);

    await insertVisit(run, {
      clinicId: clinicA,
      patientId: patientIds[1],
      appointmentId: today2,
      doctorId: doctorA,
      visitDate: at(0, "09:30"),
      complaint: "صداع متكرر منذ أسبوعين",
      vitals: "الضغط: 110/70 · النبض: 84",
      exam: "لا علامات عصبية بؤرية",
      diagnosis: "صداع توتري",
      treatment: "باراسيتامول عند اللزوم مع تحسين النوم",
      recommendations: "مراجعة بعد أسبوعين وإذا اشتد الصداع مراجعة عاجلة",
      followUp: localDate(14),
      fee: 150,
      discount: 0,
    });
    await run(PAYMENT_SQL, [newId(), clinicA, patientIds[1], null, 50, "cash", "دفعة جزئية", at(0, "09:50"), secretaryA, created]);

    await run("INSERT INTO clinic_currencies (clinic_id, code, rate, created_at) VALUES (?,?,?,?)", [clinicA, "USD", 3.75, created]);
    await run(
      "INSERT INTO payments (id, clinic_id, patient_id, visit_id, amount, currency, rate, method, note, paid_at, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [newId(), clinicA, patientIds[1], null, 20, "USD", 3.75, "transfer", "دفعة بالدولار", at(-2, "11:10"), secretaryA, created],
    );

    const expenses: [string, number, string, string][] = [
      ["إيجار العيادة", 6000, "rent", at(0, "08:00")],
      ["مستلزمات طبية", 850, "supplies", at(-3, "12:00")],
      ["فاتورة الكهرباء", 420, "utilities", at(-5, "09:00")],
      ["صيانة أجهزة", 300, "maintenance", at(-8, "14:00")],
    ];
    for (const item of expenses) {
      await run(EXPENSE_SQL, [newId(), clinicA, item[0], item[1], item[2], item[3], doctorA, created]);
    }

    await run(NOTIFICATION_SQL, [newId(), clinicA, null, "موعد جديد", "تم حجز موعد لمريض جديد اليوم الساعة 16:00", "appointment", created]);
    await run(NOTIFICATION_SQL, [newId(), clinicA, null, "مريض لم يحضر", "لم يحضر المريض ماجد سليم النعيمي لموعده أمس", "warning", created]);
  });
}
