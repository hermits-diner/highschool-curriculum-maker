"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/auth-shared";

type NavItem = { href: string; label: string };

const ROOTS = ["/admin", "/teacher", "/student"];

export default function AppShell({
  role,
  userName,
  nav,
  children,
}: {
  role: Role;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (ROOTS.includes(href)) return false;
    return pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="sticky top-0 z-20 border-b border-[var(--border)] print:hidden"
        style={{
          background: "color-mix(in srgb, var(--surface) 82%, transparent)",
          backdropFilter: "saturate(1.4) blur(10px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-15 min-h-14 flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-5 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <span
                className="grid place-items-center w-8 h-8 rounded-[9px] text-white shadow-sm"
                style={{ background: "var(--accent)" }}
                aria-hidden
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2.5 3.5h6M2.5 8h6M2.5 12.5h4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="12.5" cy="4" r="1.15" fill="currentColor" />
                  <circle cx="12.5" cy="9" r="1.15" fill="currentColor" />
                </svg>
              </span>
              <span className="font-bold text-[var(--ink)] tracking-tight">
                교육과정 편성
              </span>
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-sm text-[var(--ink-2)] hidden sm:flex items-center gap-1.5">
              {userName}
              <span className="badge badge-neutral">{ROLE_LABEL[role]}</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost text-sm">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-10">
        {children}
      </main>
      <footer className="print:hidden border-t border-[var(--border)] mt-4">
        <div className="max-w-6xl mx-auto px-4 py-5 text-xs text-[var(--faint)]">
          2022 개정교육과정 · 고교학점제 교육과정 편성 시스템
        </div>
      </footer>
    </div>
  );
}
