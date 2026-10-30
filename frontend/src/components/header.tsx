"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenCheck, ChevronDown, LogIn, LogOut, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const links = [
  ["Về trung tâm", "/gioi-thieu"], ["Khóa học", "/khoa-hoc"],
  ["Luyện đề", "/luyen-de"], ["Thư viện", "/thu-vien"],
  ["Đào tạo giáo viên", "/dao-tao-giao-vien"], ["Tin tức", "/tin-tuc"],
];
type CurrentUser = { fullName: string; email: string; role: "ADMIN" | "TEACHER" | "STUDENT" };
const api = process.env.NEXT_PUBLIC_API_URL || "/api";
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "HV";
const accountPath = (role: CurrentUser["role"]) => role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/giao-vien/dashboard" : "/hoc-vien";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`${api}/portal/overview`, { credentials: "include" })
      .then(async (response) => {
        if (!active) return;
        setOpen(false); setAccountOpen(false);
        if (!response.ok) return setUser(null);
        const data = (await response.json()) as { user: CurrentUser };
        setUser(data.user);
      }).catch(() => active && setUser(null));
    return () => { active = false; };
  }, [pathname]);
  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountOpen(false); };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  async function logout() {
    await fetch(`${api}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null); setAccountOpen(false); router.push("/"); router.refresh();
  }

  return <header className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? "shadow-[0_8px_30px_rgba(15,23,42,.09)]" : "border-b border-slate-100"}`}>
    <div className="container-shell flex h-[76px] items-center justify-between">
      <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Trang chủ Bright Path English">
        <span className="grid h-11 w-12 place-items-center rounded-xl bg-[#d91f2a] text-base font-black italic tracking-[-.08em] text-white shadow-[0_8px_20px_rgba(217,31,42,.2)]">BP</span>
        <span><strong className="block text-[15px] font-extrabold tracking-[.04em] text-[#123d68]">BRIGHT PATH</strong><small className="block text-[11px] font-bold tracking-[.12em] text-slate-500">ENGLISH CENTER</small></span>
      </Link>
      <nav className="hidden items-center gap-6 xl:flex" aria-label="Điều hướng chính">
        {links.map(([label, href]) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`group relative py-7 text-[13px] font-bold transition-colors ${active ? "text-[#d91f2a]" : "text-slate-700 hover:text-[#d91f2a]"}`}>{label}<span className={`absolute inset-x-0 bottom-4 h-0.5 origin-left bg-[#d91f2a] transition-transform duration-300 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}/></Link>; })}
      </nav>
      <div className="hidden items-center gap-3 xl:flex">
        <Link href="/lien-he" className="btn-primary min-h-11 px-5">Đăng ký học thử</Link>
        {user ? <div ref={accountRef} className="relative">
          <button type="button" onClick={() => setAccountOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pr-3 shadow-sm transition hover:border-[#123d68]/35 hover:shadow-md" aria-label="Mở menu tài khoản" aria-expanded={accountOpen}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#123d68] text-xs font-extrabold text-white">{initials(user.fullName)}</span>
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${accountOpen ? "rotate-180" : ""}`}/>
          </button>
          {accountOpen && <div className="absolute right-0 top-[calc(100%+12px)] w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_55px_rgba(9,43,76,.18)]">
            <div className="border-b border-slate-100 px-5 py-4"><p className="truncate text-sm font-extrabold text-[#092b4c]">{user.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p></div>
            <div className="p-2">
              <Link href={accountPath(user.role)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-[#123d68]"><UserRound size={18}/>{user.role === "STUDENT" ? "Thông tin cá nhân" : "Trang quản trị"}</Link>
              {user.role === "STUDENT" && <Link href="/hoc-vien#lich-su" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-[#123d68]"><BookOpenCheck size={18}/>Lịch sử luyện đề</Link>}
              <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut size={18}/>Đăng xuất</button>
            </div>
          </div>}
        </div> : <Link href="/dang-nhap" className="btn-outline min-h-11 px-5"><LogIn size={17}/>Đăng nhập</Link>}
      </div>
      <button className="rounded-lg p-2 text-[#123d68] xl:hidden" onClick={() => setOpen(!open)} aria-label="Mở menu" aria-expanded={open}>{open ? <X/> : <Menu/>}</button>
    </div>
    <div className={`overflow-hidden border-t border-slate-100 bg-white transition-[max-height] duration-500 xl:hidden ${open ? "max-h-[620px]" : "max-h-0 border-t-0"}`}>
      <nav className="container-shell grid py-3">
        {links.map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)} className="border-b border-slate-100 px-1 py-4 text-sm font-bold">{label}</Link>)}
        {user ? <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#123d68] text-xs font-extrabold text-white">{initials(user.fullName)}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#092b4c]">{user.fullName}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div></div>
          <Link href={accountPath(user.role)} onClick={() => setOpen(false)} className="btn-outline mt-4 w-full"><UserRound size={17}/>{user.role === "STUDENT" ? "Thông tin cá nhân" : "Trang quản trị"}</Link>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-extrabold text-red-600"><LogOut size={17}/>Đăng xuất</button>
        </div> : <Link href="/dang-nhap" onClick={() => setOpen(false)} className="btn-outline mt-4"><LogIn size={17}/>Đăng nhập</Link>}
        <Link href="/lien-he" onClick={() => setOpen(false)} className="btn-primary mt-3">Đăng ký học thử</Link>
      </nav>
    </div>
  </header>;
}
