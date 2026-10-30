"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, FileText, GraduationCap, Loader2, Mail, PlayCircle, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type Overview = {
  user: { fullName: string; email: string; role: "ADMIN" | "TEACHER" | "STUDENT" };
  metrics: { courses?: number; averageProgress?: number };
  enrollments?: {
    id: string;
    progress: number;
    course: {
      slug: string;
      title: string;
      ageRange: string;
      lessons: { id: string; title: string; driveUrl?: string; youtubeUrl?: string }[];
    };
  }[];
};

const api = process.env.NEXT_PUBLIC_API_URL || "/api";
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "HV";

export function StudentProfile() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/portal/overview`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/dang-nhap?returnTo=/hoc-vien");
          return null;
        }
        if (!response.ok) throw new Error("Không tải được hồ sơ học viên.");
        const value = (await response.json()) as Overview;
        if (value.user.role !== "STUDENT") {
          router.replace(value.user.role === "ADMIN" ? "/admin" : "/giao-vien/dashboard");
          return null;
        }
        return value;
      })
      .then((value) => value && setData(value))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra."));
  }, [router]);

  if (error) return <div className="container-shell py-20 text-red-700">{error}</div>;
  if (!data) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-[#d91f2a]" size={34}/></div>;

  const progress = data.metrics.averageProgress ?? 0;
  const lessonCount = data.enrollments?.reduce((sum, item) => sum + item.course.lessons.length, 0) ?? 0;

  return <section className="bg-[#f3f6fa] pb-8 pt-10">
    <div className="container-shell">
      <div className="surface-panel px-6 py-7 md:px-9 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#123d68] text-xl font-black text-white shadow-[0_12px_28px_rgba(18,61,104,.2)]">{initials(data.user.fullName)}</span>
            <div><h1 className="text-2xl font-extrabold text-[#092b4c] md:text-3xl">{data.user.fullName}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Mail size={15}/>{data.user.email}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><ShieldCheck size={20}/><div><strong className="block">Tài khoản học viên</strong><span className="text-xs text-emerald-700">Đang hoạt động</span></div></div>
        </div>
      </div>

      <div className="metric-strip mt-6">
        {[[BookOpen, "Khóa học đang tham gia", data.metrics.courses ?? 0], [GraduationCap, "Tiến độ trung bình", `${progress}%`], [FileText, "Bài học trong lộ trình", lessonCount]].map(([Icon, label, value]) => { const MetricIcon = Icon as typeof BookOpen; return <div key={String(label)} className="metric-cell flex items-center gap-4"><MetricIcon className="shrink-0 text-[#d91f2a]" size={24}/><div><strong>{String(value)}</strong><span className="mt-2 block text-xs font-bold text-slate-500">{String(label)}</span></div></div>; })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="surface-panel h-fit p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#092b4c]"><UserRound size={20}/>Thông tin tài khoản</h2>
          <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Họ và tên</dt><dd className="mt-1 font-bold text-slate-800">{data.user.fullName}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Email đăng nhập</dt><dd className="mt-1 break-all text-slate-600">{data.user.email}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Vai trò</dt><dd className="mt-1"><span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Học viên</span></dd></div></dl>
          <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-xs leading-5 text-slate-500">Thông tin cá nhân được trung tâm quản lý. Liên hệ quản trị viên nếu bạn cần thay đổi tên hoặc email.</p></div>
          <Link href="/luyen-de" className="btn-primary mt-5 w-full"><PlayCircle size={17}/>Luyện đề ngay</Link>
        </aside>

        <section className="surface-panel p-6 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold text-[#092b4c]">Khóa học đang tham gia</h2><Link href="/khoa-hoc" className="text-sm font-extrabold text-[#123d68]">Xem tất cả khóa học →</Link></div>
          <div className="mt-6 space-y-4">
            {data.enrollments?.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-5 transition hover:border-[#123d68]/25 hover:shadow-[0_12px_35px_rgba(9,43,76,.07)]">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-extrabold text-[#092b4c]">{item.course.title}</h3><p className="mt-1 text-xs text-slate-500">Độ tuổi: {item.course.ageRange}</p></div><strong className="rounded-full bg-[#fff0f1] px-3 py-1 text-sm text-[#d91f2a]">{item.progress}%</strong></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#d91f2a] transition-[width]" style={{ width: `${item.progress}%` }}/></div>
              <div className="mt-5 grid gap-2">{item.course.lessons.slice(0, 3).map((lesson, index) => <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><span className="flex items-center gap-2 text-xs font-bold text-slate-700"><CheckCircle2 size={15} className="text-slate-400"/>{index + 1}. {lesson.title}</span>{lesson.driveUrl || lesson.youtubeUrl ? <a href={lesson.driveUrl || lesson.youtubeUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-extrabold text-[#d91f2a]">Mở bài</a> : <span className="shrink-0 text-[11px] text-slate-400">Chờ học liệu</span>}</div>)}</div>
              <Link href={`/khoa-hoc/${item.course.slug}`} className="mt-5 inline-flex text-xs font-extrabold text-[#123d68]">Xem chi tiết chương trình →</Link>
            </article>)}
            {!data.enrollments?.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><BookOpen className="mx-auto text-slate-300" size={34}/><p className="mt-3 text-sm text-slate-500">Bạn chưa được ghi danh vào khóa học nào.</p><Link href="/lien-he" className="mt-4 inline-flex text-sm font-extrabold text-[#d91f2a]">Liên hệ trung tâm →</Link></div>}
          </div>
        </section>
      </div>
    </div>
  </section>;
}
