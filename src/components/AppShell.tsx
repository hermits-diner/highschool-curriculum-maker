import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/auth-shared";

type NavItem = { href: string; label: string };

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
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="font-bold text-slate-900 shrink-0">
              교육과정 편성
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg whitespace-nowrap transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-slate-600 hidden sm:inline">
              {userName}
              <span className="ml-1.5 text-xs text-slate-400">
                {ROLE_LABEL[role]}
              </span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
