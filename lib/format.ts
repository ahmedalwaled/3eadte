export const APPOINTMENT_STATUS: Record<string, { label: string; tone: string }> = {
  booked: { label: "محجوز", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  arrived: { label: "حضر", tone: "bg-teal-50 text-teal-700 ring-teal-200" },
  waiting: { label: "في الانتظار", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  in_visit: { label: "داخل المعاينة", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  done: { label: "انتهت", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  no_show: { label: "لم يحضر", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  cancelled: { label: "ملغي", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const STATUS_FLOW = ["booked", "arrived", "waiting", "in_visit", "done", "no_show", "cancelled"];

const dateFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return shortFormatter.format(d);
}

export function formatWeekday(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return weekdayFormatter.format(d);
}

const dateTimeFormatter = new Intl.DateTimeFormat("ar-EG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

export function timeOf(startsAt: string): string {
  return startsAt.slice(11, 16);
}

export function dateOf(startsAt: string): string {
  return startsAt.slice(0, 10);
}

const CURRENCIES: Record<string, string> = {
  SAR: "ر.س",
  AED: "د.إ",
  EGP: "ج.م",
  JOD: "د.أ",
  USD: "$",
  QAR: "ر.ق",
  KWD: "د.ك",
  BHD: "د.ب",
  OMR: "ر.ع",
  IQD: "د.ع",
  LYD: "د.ل",
  MAD: "د.م",
  TND: "د.ت",
  DZD: "د.ج",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
};

/** Currencies a clinic can choose as its base currency, or add as a secondary one. */
export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "SAR", label: "ريال سعودي" },
  { code: "AED", label: "درهم إماراتي" },
  { code: "QAR", label: "ريال قطري" },
  { code: "KWD", label: "دينار كويتي" },
  { code: "BHD", label: "دينار بحريني" },
  { code: "OMR", label: "ريال عماني" },
  { code: "JOD", label: "دينار أردني" },
  { code: "EGP", label: "جنيه مصري" },
  { code: "IQD", label: "دينار عراقي" },
  { code: "LYD", label: "دينار ليبي" },
  { code: "TND", label: "دينار تونسي" },
  { code: "DZD", label: "دينار جزائري" },
  { code: "MAD", label: "درهم مغربي" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "EUR", label: "يورو" },
  { code: "GBP", label: "جنيه إسترليني" },
  { code: "TRY", label: "ليرة تركية" },
];

/** A currency configured for a clinic; rate = how many base-currency units one unit is worth. */
export type ClinicCurrency = { code: string; rate: number };

export function currencyLabel(code: string): string {
  const found = CURRENCY_OPTIONS.find((item) => item.code === code);
  return found ? `${found.label} (${code})` : code;
}

export function currencySymbol(code: string): string {
  return CURRENCIES[code] ?? code;
}

export function money(amount: number, currency = "SAR"): string {
  const value = Number(amount || 0);
  const formatted = value.toLocaleString("en-US", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return `${formatted} ${CURRENCIES[currency] ?? currency}`;
}

export function age(birthDate: string): string {
  if (!birthDate) return "—";
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return `${years} سنة`;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  return { from, to: `${y}-${String(m).padStart(2, "0")}-${last}` };
}

export function initials(name: string): string {
  const parts = name.replace(/^د\.\s*/, "").trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
