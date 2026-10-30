import Link from "next/link";
import { ArrowRight, Clock, Users } from "lucide-react";

type CourseCardProps = { course: { slug: string; title: string; age: string; level: string; duration: string; summary: string } };
export function CourseCard({ course }: CourseCardProps) {
  return <article className="group grid gap-5 border-t border-slate-200 py-8 first:border-t-0 md:grid-cols-[170px_1fr_auto] md:items-center md:gap-8">
    <div className="text-sm font-extrabold text-[#d91f2a]">{course.level}<span className="mt-2 block text-xs font-semibold text-slate-500">{course.age}</span></div>
    <div><h2 className="text-2xl font-extrabold text-[#092b4c] transition-colors group-hover:text-[#123d68]">{course.title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{course.summary}</p><div className="mt-4 flex flex-wrap gap-5 text-xs font-bold text-slate-500"><span className="flex items-center gap-2"><Users size={16}/>{course.age}</span><span className="flex items-center gap-2"><Clock size={16}/>{course.duration}</span></div></div>
    <Link href={`/khoa-hoc/${course.slug}`} className="btn-outline w-full md:w-auto">Xem chi tiết <ArrowRight size={16}/></Link>
  </article>;
}
