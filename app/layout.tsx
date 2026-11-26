import type { Metadata, Viewport } from "next";
import OfflineNotice from "@/components/OfflineNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: "عيادتي | منصة إدارة العيادات",
  description: "منصة متكاملة لإدارة العيادات: المواعيد، الملفات الطبية، الوصفات، الحسابات والتقارير.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "عيادتي", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <OfflineNotice />
        {children}
      </body>
    </html>
  );
}
