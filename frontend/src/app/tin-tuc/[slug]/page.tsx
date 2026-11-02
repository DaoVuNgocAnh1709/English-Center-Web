import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { news } from "@/lib/site-data";

type Params = { slug: string };

export function generateStaticParams() {
  return news.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = news.find((item) => item.slug === slug);
  return post
    ? { title: post.title, description: post.excerpt }
    : { title: "Không tìm thấy bài viết" };
}

export default async function NewsDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = news.find((item) => item.slug === slug);
  if (!post) notFound();
  const related = news.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <>
      <section className="bg-[#082f55] text-white">
        <div className="container-shell py-14 md:py-20">
          <Link
            href="/tin-tuc"
            className="inline-flex items-center gap-2 text-xs font-bold text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft size={15} /> Góc học tập
          </Link>
          <p className="mt-8 text-xs font-extrabold uppercase tracking-[.12em] text-[#ef5961]">
            {post.category} · {post.date}
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-.02em] md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/80">{post.excerpt}</p>
        </div>
      </section>

      <section className="bg-[#f3f6fa] py-12 md:py-16">
        <div className="container-shell grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="surface-panel overflow-hidden">
            <div className="relative h-64 md:h-80">
              <Image
                src="/images/learning-project.png"
                alt="Ảnh minh họa bài viết"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            </div>
            <div className="max-w-[68ch] space-y-5 p-7 text-[15px] leading-8 text-slate-700 md:p-10">
              {post.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            <div className="surface-panel p-6">
              <h2 className="font-extrabold text-[#092b4c]">Bài viết khác</h2>
              <div className="mt-4 divide-y divide-slate-200">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/tin-tuc/${item.slug}`}
                    className="group block py-4 first:pt-0 last:pb-0"
                  >
                    <span className="text-[11px] font-bold text-[#d91f2a]">{item.category}</span>
                    <span className="mt-1 block text-sm font-bold leading-6 text-[#092b4c] transition-colors group-hover:text-[#d91f2a]">
                      {item.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="surface-panel bg-[#092b4c] p-6 text-white">
              <h2 className="font-extrabold">Cần tư vấn lộ trình cho con?</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Đăng ký học thử miễn phí để giáo viên đánh giá trình độ và gợi ý chương trình phù hợp.
              </p>
              <Link href="/#dang-ky" className="btn-primary mt-5 w-full">
                Đăng ký học thử <ArrowRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
