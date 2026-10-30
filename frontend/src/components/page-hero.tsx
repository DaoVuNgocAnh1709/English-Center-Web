import Link from "next/link";

type PageHeroProps = { kicker: string; title: string; description: string };

export function PageHero({ kicker, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#082f55] text-white">
      <div className="absolute inset-y-0 right-0 hidden w-[34%] bg-[#0e3a65] lg:block" />
      <div className="container-shell relative grid min-h-[390px] items-end gap-12 py-16 md:py-20 lg:grid-cols-[1.35fr_.65fr]">
        <div>
          <nav aria-label="Đường dẫn" className="mb-8 flex items-center gap-2 text-xs font-bold text-white/70">
            <Link href="/" className="transition-colors hover:text-white">Trang chủ</Link>
            <span aria-hidden="true" className="text-[#ef5961]">/</span>
            <span aria-current="page">{kicker}</span>
          </nav>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-[-.035em] md:text-6xl">
            {title}
          </h1>
        </div>
        <div className="relative lg:pb-2 lg:pl-10">
          <span aria-hidden="true" className="absolute -left-3 top-1 hidden h-16 w-px bg-[#ef5961] lg:block" />
          <p className="max-w-xl text-base leading-8 text-white/82 md:text-lg">{description}</p>
        </div>
      </div>
    </section>
  );
}
