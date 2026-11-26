"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { initials } from "@/lib/format";
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  HomeIcon,
  LogoutIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from "./icons";

type ShellUser = {
  name: string;
  role: string;
  clinicName: string | null;
  specialty: string;
};

type NavItem = { href: string; label: string; icon: (props: { className?: string }) => React.ReactElement };

const ROLE_LABEL: Record<string, string> = {
  doctor: "طبيب",
  secretary: "سكرتيرة",
  platform_admin: "مدير المنصة",
};

function navFor(role: string): NavItem[] {
  if (role === "platform_admin") {
    return [{ href: "/admin", label: "العيادات والحسابات", icon: ShieldIcon }];
  }
  const items: NavItem[] = [
    { href: "/dashboard", label: "لوحة التحكم", icon: HomeIcon },
    { href: "/appointments", label: "المواعيد", icon: CalendarIcon },
    { href: "/patients", label: "المرضى", icon: UsersIcon },
    { href: "/finance", label: "الحسابات", icon: WalletIcon },
    { href: "/reports", label: "التقارير", icon: ChartIcon },
  ];
  if (role === "doctor")
    items.push(
      { href: "/audit", label: "سجل التدقيق", icon: ShieldIcon },
      { href: "/settings", label: "الإعدادات", icon: SettingsIcon },
    );
  return items;
}

export default function AppShell({
  user,
  unread,
  children,
}: {
  user: ShellUser;
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navFor(user.role);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navList = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-brand-50 text-brand-800 ring-1 ring-brand-100" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className={`size-5 ${active ? "text-brand-700" : "text-slate-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-slate-200 bg-white/80 px-4 py-5 backdrop-blur lg:flex">
        <Link href={user.role === "platform_admin" ? "/admin" : "/dashboard"} className="flex items-center gap-3 px-1">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-700 text-base font-bold text-white">ع</div>
          <div>
            <p className="text-base font-extrabold text-slate-900">عيادتي</p>
            <p className="max-w-[9rem] truncate text-[11px] text-slate-500">{user.clinicName ?? "إدارة المنصة"}</p>
          </div>
        </Link>

        <div className="mt-6 flex-1">{navList}</div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
          <p className="text-[11px] text-slate-500">
            {ROLE_LABEL[user.role] ?? user.role}
            {user.specialty ? ` · ${user.specialty}` : ""}
          </p>
          <form action={logoutAction} className="mt-2">
            <button className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600">
              <LogoutIcon className="size-4" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
              aria-expanded={open}
              className="grid size-10 place-items-center rounded-xl ring-1 ring-slate-200 lg:hidden"
            >
              <span className="flex flex-col gap-1">
                <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
                <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${open ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
              </span>
            </button>
            <div className="lg:hidden">
              <p className="text-sm font-extrabold text-slate-900">{user.clinicName ?? "عيادتي"}</p>
              <p className="text-[11px] text-slate-500">
                {ROLE_LABEL[user.role] ?? user.role} · {user.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label={`الإشعارات (${unread} غير مقروء)`}
              className="relative grid size-10 place-items-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <BellIcon className="size-5 text-slate-600" />
              {unread > 0 ? (
                <span className="absolute -top-1 -left-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 sm:flex">
              <div className="grid size-8 place-items-center rounded-lg bg-brand-700 text-xs font-bold text-white">
                {initials(user.name)}
              </div>
              <span className="max-w-32 truncate text-xs font-semibold text-slate-700">{user.name}</span>
            </div>
            <form action={logoutAction} className="sm:hidden">
              <button aria-label="خروج" className="grid size-10 place-items-center rounded-xl ring-1 ring-slate-200">
                <LogoutIcon className="size-5 text-slate-600" />
              </button>
            </form>
          </div>
        </header>

        {open ? (
          <div className="no-print border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            {navList}
            <form action={logoutAction} className="mt-2 border-t border-slate-100 pt-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-500">
                <LogoutIcon className="size-4" />
                تسجيل الخروج
              </button>
            </form>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 lg:px-6 lg:pb-8">{children}</main>

        <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
            {items.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
                      active ? "text-brand-700" : "text-slate-500"
                    }`}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
