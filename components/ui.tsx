import { APPOINTMENT_STATUS } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  const item = APPOINTMENT_STATUS[status] ?? { label: status, tone: "bg-slate-100 text-slate-600 ring-slate-200" };
  return <span className={`badge ${item.tone}`}>{item.label}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "amber" | "sky" | "rose";
}) {
  const tones: Record<string, string> = {
    brand: "from-brand-50 to-white text-brand-800",
    amber: "from-amber-50 to-white text-amber-800",
    sky: "from-sky-50 to-white text-sky-800",
    rose: "from-rose-50 to-white text-rose-800",
  };
  return (
    <div className={`card bg-gradient-to-bl p-4 ${tones[accent]}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {body ? <p className="max-w-sm text-xs text-slate-500">{body}</p> : null}
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
