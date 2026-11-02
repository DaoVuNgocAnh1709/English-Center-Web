import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { news } from "@/lib/site-data";

export const metadata = { title: "Tin tức và góc học tập" };

export default function NewsPage() {
  const [featured, ...articles] = news;
  return <>
    <PageHero kicker="Góc học tập" title="Kiến thức, phương pháp và hoạt động tại trung tâm" description="Nội dung hỗ trợ phụ huynh và học viên xây dựng thói quen học tiếng Anh hiệu quả hơn mỗi ngày." />
    <section className="bg-[#f3f6fa] py-16 md:py-20">
      <div className="container-shell grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
        {featured && <article className="surface-panel image-zoom overflow-hidden"><div className="relative min-h-[320px] overflow-hidden md:min-h-[420px]"><Image src="/images/learning-project.png" fill alt="Ảnh minh họa bài viết nổi bật" className="object-cover" /></div><div className="p-7 md:p-9"><div className="flex items-center gap-3 text-xs font-bold text-slate-500"><span className="text-[#d91f2a]">{featured.category}</span><span>Kiến thức dành cho phụ huynh</span></div><h2 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight text-[#092b4c]">{featured.title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{featured.excerpt}</p><Link href={`/tin-tuc/${featured.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#123d68]">Đọc bài viết <ArrowRight size={16} /></Link></div></article>}
        <div className="surface-panel h-fit px-6 md:px-7">{articles.map((item, index) => <article key={item.slug} className="border-t border-slate-200 py-7 first:border-t-0"><div className="text-xs font-bold text-[#d91f2a]">{item.category}</div><h2 className="mt-3 text-xl font-extrabold leading-7 text-[#092b4c]">{item.title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{item.excerpt}</p><Link href={`/tin-tuc/${item.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#123d68]">Đọc tiếp <ArrowRight size={15} /></Link>{index === 0 && <div className="relative mt-6 h-40 overflow-hidden rounded-xl"><Image src="/images/hero-classroom.png" fill alt="Hoạt động học tập" className="object-cover" /></div>}</article>)}</div>
      </div>
    </section>
  </>;
}
