import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "고교 교육과정 편성 시스템",
  description: "2022 개정교육과정(고교학점제) 교육과정 편성·수강신청 지원",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
