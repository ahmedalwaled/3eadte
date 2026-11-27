import path from "node:path";
import PDFDocument from "pdfkit";
import { formatDate, money } from "@/lib/format";

const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoNaskhArabic.ttf");

const TEAL = "#0f766e";
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#d1d5db";

export type PdfClinic = { name: string; phone?: string | null; address?: string | null };

export type PdfPatient = { name: string; code?: string | null; phone?: string | null; birth_date?: string | null; age?: string };

/**
 * pdfkit lays out mixed Arabic/Latin runs but drops the single space at a direction boundary,
 * so spaces next to ASCII (digits, latin text) are doubled to survive the run split.
 */
function rtl(text: string): string {
  return String(text ?? "").replace(/ /g, "  ");
}

type Ctx = { doc: PDFKit.PDFDocument; left: number; width: number; right: number };

function context(doc: PDFKit.PDFDocument): Ctx {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  return { doc, left, width, right: left + width };
}

function line(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  align: "right" | "left" | "center" = "right",
): number {
  const { doc } = c;
  doc.fontSize(size).fillColor(color);
  const height = doc.heightOfString(rtl(text), { width });
  doc.text(rtl(text), x, y, { width, align });
  return y + height + 3;
}

function header(c: Ctx, clinic: PdfClinic, title: string, subtitle: string[]) {
  const { doc } = c;
  const startY = doc.y;

  let y = line(c, clinic.name, c.left, startY, c.width, 17, TEAL);
  y = line(c, title, c.left, y, c.width, 12, INK);
  if (clinic.address) y = line(c, clinic.address, c.left, y, c.width, 9, MUTED);
  if (clinic.phone) y = line(c, clinic.phone, c.left, y, c.width, 9, MUTED);
  for (const item of subtitle) y = line(c, item, c.left, y, c.width, 9, MUTED);

  doc.y = y + 8;
  doc.save().moveTo(c.left, doc.y).lineTo(c.right, doc.y).lineWidth(1.2).strokeColor(TEAL).stroke().restore();
  doc.y += 14;
}

function infoGrid(c: Ctx, pairs: [string, string][]) {
  const { doc } = c;
  const half = (c.width - 24) / 2;
  let y = doc.y;
  for (let index = 0; index < pairs.length; index += 2) {
    const rightPair = pairs[index];
    let yRight = line(c, `${rightPair[0]}: ${rightPair[1]}`, c.right - half, y, half, 10, INK);
    let yLeft = y;
    const leftPair = pairs[index + 1];
    if (leftPair) {
      yLeft = line(c, `${leftPair[0]}: ${leftPair[1]}`, c.left, y, half, 10, INK, "right");
    }
    y = Math.max(yRight, yLeft) + 6;
  }
  doc.y = y + 6;
}

type Column = { title: string; width: number; align?: "right" | "left" };

function table(c: Ctx, columns: Column[], rows: string[][]) {
  const { doc } = c;
  const pad = 5;
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const headerH = 22;
  const rowH = (values: string[]) => {
    let height = 0;
    columns.forEach((column, index) => {
      height = Math.max(height, doc.heightOfString(rtl(values[index] ?? ""), { width: column.width - pad * 2 }));
    });
    return height + 10;
  };

  const drawHeader = (y: number) => {
    doc.save().rect(c.left, y, total, headerH).fill("#e7f3f1").restore();
    let x = c.left + total;
    doc.fontSize(9).fillColor(TEAL);
    for (const column of columns) {
      x -= column.width;
      doc.text(rtl(column.title), x + pad, y + 6, { width: column.width - pad * 2, align: column.align ?? "right" });
    }
    return y + headerH;
  };

  let y = drawHeader(doc.y);
  doc.fillColor(INK);
  for (const values of rows) {
    const height = rowH(values);
    if (y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = drawHeader(doc.y);
      doc.fillColor(INK);
    }
    let x = c.left + total;
    for (const [index, column] of columns.entries()) {
      x -= column.width;
      doc.fontSize(9).fillColor(INK).text(rtl(values[index] ?? ""), x + pad, y + 5, { width: column.width - pad * 2, align: column.align ?? "right" });
    }
    doc.save().moveTo(c.left, y + height).lineTo(c.left + total, y + height).lineWidth(0.5).strokeColor(LINE).stroke().restore();
    y += height;
  }
  doc.y = y + 12;
}

function notice(c: Ctx, label: string, body: string) {
  const { doc } = c;
  const text = rtl(`${label}: ${body}`);
  doc.fontSize(9);
  const height = doc.heightOfString(text, { width: c.width - 24 }) + 16;
  const y = doc.y;
  doc.save().roundedRect(c.left, y, c.width, height, 6).fill("#fffbeb").restore();
  doc.fontSize(9).fillColor("#7c2d12").text(text, c.left + 12, y + 8, { width: c.width - 24, align: "right" });
  doc.y = y + height + 12;
}

function totals(c: Ctx, boxes: { label: string; value: string }[]) {
  const { doc } = c;
  const gap = 10;
  const boxW = (c.width - gap * (boxes.length - 1)) / boxes.length;
  const y = doc.y;
  boxes.forEach((box, index) => {
    const x = c.right - boxW * (index + 1) - gap * index;
    doc.save().roundedRect(x, y, boxW, 48, 6).lineWidth(0.8).strokeColor(LINE).stroke().restore();
    doc.fontSize(8).fillColor(MUTED).text(rtl(box.label), x + 8, y + 8, { width: boxW - 16, align: "right" });
    doc.fontSize(11).fillColor(INK).text(rtl(box.value), x + 8, y + 24, { width: boxW - 16, align: "right" });
  });
  doc.y = y + 60;
}

function footer(c: Ctx, lines: string[]) {
  const { doc } = c;
  const y = Math.max(doc.y + 18, doc.page.height - doc.page.margins.bottom - 44);
  doc.save().moveTo(c.left, y).lineTo(c.right, y).lineWidth(0.5).strokeColor(LINE).stroke().restore();
  let textY = y + 8;
  for (const item of lines) textY = line(c, item, c.left, textY, c.width, 8, MUTED);
}

function render(build: (c: Ctx) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, info: { Producer: "Clinic Platform" } });
    doc.registerFont("ar", FONT_PATH);
    doc.font("ar");
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(context(doc));
    } catch (error) {
      reject(error as Error);
      return;
    }
    doc.end();
  });
}

export type PrescriptionItem = { drug: string; dose: string; frequency: string; duration: string };

export function prescriptionPdf(input: {
  clinic: PdfClinic;
  patient: PdfPatient;
  doctor: string;
  specialty?: string | null;
  createdAt: string;
  reference: string;
  items: PrescriptionItem[];
  instructions?: string | null;
}): Promise<Buffer> {
  return render((c) => {
    header(c, input.clinic, "وصفة طبية", [`التاريخ: ${formatDate(input.createdAt.slice(0, 10))}`, `رقم الوصفة: ${input.reference}`]);
    infoGrid(c, [
      ["المريض", input.patient.name],
      ["رقم الملف", input.patient.code ?? "—"],
      ["العمر", input.patient.age ?? "—"],
      ["الجوال", input.patient.phone ?? "—"],
    ]);

    table(
      c,
      [
        { title: "#", width: 34 },
        { title: "الدواء", width: 170 },
        { title: "الجرعة", width: 90 },
        { title: "التكرار", width: 105 },
        { title: "المدة", width: 112 },
      ],
      input.items.map((item, index) => [String(index + 1), item.drug, item.dose, item.frequency, item.duration]),
    );

    if (input.instructions) notice(c, "تعليمات", input.instructions);
    footer(c, [input.doctor, input.specialty ? `التخصص: ${input.specialty}` : "", "التوقيع: ____________________"].filter(Boolean));
  });
}

export type StatementRow = { date: string; label: string; charge: string; credit: string; balance: number };

export function statementPdf(input: {
  clinic: PdfClinic;
  patient: PdfPatient;
  currency: string;
  from?: string;
  to?: string;
  rows: StatementRow[];
  due: number;
  paid: number;
  balance: number;
}): Promise<Buffer> {
  return render((c) => {
    const range = input.from || input.to ? `${input.from || "البداية"} — ${input.to || "اليوم"}` : "كل الحركات";
    header(c, input.clinic, "كشف حساب", [range, `العملة: ${input.currency}`]);
    infoGrid(c, [
      ["المريض", input.patient.name],
      ["رقم الملف", input.patient.code ?? "—"],
      ["الجوال", input.patient.phone ?? "—"],
      ["العمر", input.patient.age ?? "—"],
    ]);
    totals(c, [
      { label: "المستحق", value: money(input.due, input.currency) },
      { label: "المدفوع", value: money(input.paid, input.currency) },
      { label: "الرصيد", value: money(input.balance, input.currency) },
    ]);
    table(
      c,
      [
        { title: "التاريخ", width: 82 },
        { title: "البيان", width: 205 },
        { title: "مدين", width: 75 },
        { title: "دائن", width: 75 },
        { title: "الرصيد", width: 74 },
      ],
      input.rows.map((row) => [formatDate(row.date.slice(0, 10)), row.label, row.charge, row.credit, money(row.balance, input.currency)]),
    );
    footer(c, [`صدر بتاريخ ${formatDate(new Date().toISOString().slice(0, 10))}`, "هذا كشف حساب آلي من نظام العيادة."]);
  });
}

export function receiptPdf(input: {
  clinic: PdfClinic;
  patient: PdfPatient;
  baseCurrency: string;
  payment: { amount: number; currency: string; rate: number; method: string; note?: string | null; paid_at: string; reference: string };
}): Promise<Buffer> {
  return render((c) => {
    const { payment } = input;
    header(c, input.clinic, "إيصال دفع", [`التاريخ: ${formatDate(payment.paid_at.slice(0, 10))}`, `رقم الإيصال: ${payment.reference}`]);
    infoGrid(c, [
      ["المريض", input.patient.name],
      ["رقم الملف", input.patient.code ?? "—"],
      ["الجوال", input.patient.phone ?? "—"],
      ["طريقة الدفع", payment.method],
    ]);
    totals(c, [
      { label: "المبلغ المدفوع", value: money(payment.amount, payment.currency) },
      { label: `بقيمة ${input.baseCurrency}`, value: money(payment.amount * (payment.rate || 1), input.baseCurrency) },
    ]);
    if (payment.note) notice(c, "ملاحظة", payment.note);
    footer(c, ["شكرًا لكم.", "التوقيع: ____________________"]);
  });
}
