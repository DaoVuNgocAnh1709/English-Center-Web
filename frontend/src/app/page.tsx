import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, Check, ChevronRight, ClipboardCheck,
  GraduationCap, MapPin, MessageCircle, Play, Quote, ShieldCheck, Users,
} from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { Reveal } from "@/components/reveal";

const programs = [
  { icon: BookOpenCheck, age: "6–8 tuổi", title: "Tiếng Anh nền tảng", text: "Làm quen phát âm, từ vựng và phản xạ giao tiếp qua hoạt động phù hợp với lứa tuổi." },
  { icon: MessageCircle, age: "9–11 tuổi", title: "Tiếng Anh tiểu học", text: "Củng cố kiến thức học đường, đồng thời phát triển khả năng nghe, nói và sự tự tin." },
  { icon: GraduationCap, age: "12–15 tuổi", title: "Tiếng Anh THCS", text: "Hệ thống ngữ pháp, bốn kỹ năng và nội dung ôn tập theo mục tiêu học tập." },
];

const news = [
  { tag: "Kinh nghiệm học", date: "28.10.2026", title: "5 cách giúp trẻ duy trì thói quen tiếng Anh tại nhà", image: "/images/learning-project.png" },
  { tag: "Phương pháp", date: "20.10.2026", title: "Học từ vựng thế nào để hiểu và nhớ lâu hơn?", image: "/images/hero-classroom.png" },
  { tag: "Hoạt động lớp", date: "12.10.2026", title: "Một buổi học giao tiếp tại trung tâm diễn ra như thế nào?", image: "/images/learning-project.png" },
];

export default function Home() {
  return (
    <>
      <section className="relative min-h-[650px] overflow-hidden bg-[#092b4c] lg:min-h-[720px]">
        <Image src="/images/hero-classroom.png" alt="Lớp học tiếng Anh với giáo viên và học sinh" fill loading="eager" fetchPriority="high" className="hero-image object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071f36]/95 via-[#092b4c]/75 to-[#092b4c]/10" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#071f36]/25 to-transparent" />
        <div className="container-shell relative flex min-h-[650px] items-center py-20 lg:min-h-[720px]">
          <div className="hero-enter max-w-[690px] text-white">
            <h1 className="text-[40px] font-extrabold leading-[1.1] tracking-[-.045em] sm:text-5xl lg:text-[64px]">Học chắc nền tảng.<br />Tự tin dùng tiếng Anh.</h1>
            <p className="mt-7 max-w-[590px] text-base font-medium leading-8 text-white/88 sm:text-lg">Chương trình tiếng Anh dành cho học sinh, kết hợp kiến thức học đường với giao tiếp thực tế và lộ trình theo sát từng giai đoạn.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="#dang-ky" className="btn-primary">Đăng ký học thử miễn phí <ArrowRight size={17} /></Link>
              <Link href="#chuong-trinh" className="btn-light">Khám phá khóa học</Link>
            </div>
          </div>
        </div>
        <a href="#gioi-thieu" aria-label="Cuộn xuống" className="scroll-cue absolute bottom-7 left-1/2 hidden rounded-full border border-white/40 p-2 text-white md:block"><ChevronRight className="rotate-90" size={20} /></a>
      </section>

      <section className="relative z-10 -mt-1 bg-white py-10 shadow-[0_-12px_35px_rgba(8,31,54,.08)]">
        <div className="container-shell grid grid-cols-2 divide-x divide-slate-200 md:grid-cols-4">
          {[["100+", "Học viên hiện tại"], ["02", "Khu vực phát triển"], ["03", "Nhóm chương trình"], ["01:01", "Tư vấn lộ trình"]].map(([value, label]) => (
            <div key={label} className="px-3 py-3 text-center md:px-8"><strong className="block text-3xl font-extrabold text-[#d91f2a] md:text-4xl">{value}</strong><span className="mt-2 block text-xs font-bold text-slate-500 md:text-sm">{label}</span></div>
          ))}
        </div>
      </section>

      <section id="chuong-trinh" className="overflow-hidden py-20 md:py-28">
        <div className="container-shell grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr] lg:gap-20">
          <Reveal>
            <h2 className="section-title">Chương trình học<br />tại Bright Path</h2>
            <div className="mt-9 divide-y divide-slate-200 border-y border-slate-200">
              {programs.map(({ icon: Icon, age, title }) => (
                <Link href="#dang-ky" key={title} className="group flex items-center gap-4 py-5">
                  <Icon className="shrink-0 text-[#d91f2a]" size={23} />
                  <div className="min-w-0 flex-1"><h3 className="font-extrabold text-slate-900 transition-colors group-hover:text-[#d91f2a]">{title}</h3><span className="mt-1 block text-xs font-semibold text-slate-500">Dành cho học viên {age}</span></div>
                  <ChevronRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
            <Link href="#dang-ky" className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#123d68]">Xem tất cả chương trình <ArrowRight size={17} /></Link>
          </Reveal>
          <Reveal delay={120} className="relative">
            <div className="image-zoom relative overflow-hidden rounded-[22px] shadow-[0_24px_70px_rgba(15,35,58,.18)]">
              <Image src="/images/learning-project.png" alt="Học sinh tham gia hoạt động tiếng Anh" width={1200} height={900} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-[#092b4c]/85 to-transparent p-7 pt-24 text-white">
                <div><span className="text-xs font-bold uppercase tracking-[.16em] text-white/70">Học qua trải nghiệm</span><p className="mt-2 text-xl font-extrabold">Tự tin trong từng hoạt động</p></div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#d91f2a] shadow-lg"><Play fill="currentColor" size={18} /></span>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-7 hidden rounded-2xl bg-[#d91f2a] px-7 py-6 text-white shadow-xl md:block"><strong className="text-3xl font-extrabold">100+</strong><span className="ml-3 text-sm font-bold">học viên đồng hành</span></div>
          </Reveal>
        </div>
      </section>

      <section id="gioi-thieu" className="bg-[#f5f7fa] py-20 md:py-28">
        <div className="container-shell">
          <Reveal className="mx-auto max-w-3xl text-center"><h2 className="section-title">Môi trường học tập gần gũi,<br />lộ trình rõ ràng</h2><p className="mx-auto mt-5 max-w-2xl leading-8 text-slate-600">Mỗi trải nghiệm được thiết kế để học viên dễ bắt đầu, hiểu mình đang học gì và tiến bộ theo từng mục tiêu nhỏ.</p></Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {programs.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 90} className="h-full">
                <article className="soft-card group h-full p-7 transition duration-300 hover:-translate-y-2 hover:shadow-[0_22px_55px_rgba(20,45,75,.12)] md:p-8">
                  <div className="flex items-start gap-4">
                    <Icon className="mt-0.5 shrink-0 text-[#d91f2a]" size={28} />
                    <div><h3 className="text-xl font-extrabold text-[#092b4c]">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></div>
                  </div>
                  <Link href="#dang-ky" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#123d68]">Tìm hiểu thêm <ArrowRight size={16} /></Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="doi-ngu" className="py-20 md:py-28">
        <div className="container-shell grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <Reveal className="relative">
            <div className="image-zoom overflow-hidden rounded-[22px]"><Image src="/images/hero-classroom.png" alt="Giáo viên hướng dẫn học sinh trong lớp" width={1400} height={1000} className="aspect-[5/4] w-full object-cover" /></div>
            <div className="absolute -bottom-6 right-5 rounded-2xl bg-white p-5 shadow-[0_18px_50px_rgba(12,36,61,.18)] md:right-[-24px]"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#d91f2a]">Đội ngũ chuyên môn</p><strong className="mt-1 block text-lg text-[#092b4c]">Tận tâm · Thấu hiểu</strong></div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="section-title">Giáo viên đồng hành trong từng bước tiến</h2>
            <p className="mt-6 leading-8 text-slate-600">Hồ sơ giáo viên chính thức sẽ được cập nhật khi trung tâm cung cấp thông tin. Hệ thống đã sẵn sàng hiển thị chuyên môn, chứng chỉ và chương trình phụ trách.</p>
            <div className="mt-7 grid gap-4">
              {["Thông tin chuyên môn minh bạch", "Phân công phù hợp chương trình và độ tuổi", "Theo dõi bài học và kết quả học viên"].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-bold text-slate-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff0f1] text-[#d91f2a]"><Check size={16} /></span>{item}</div>)}
            </div>
            <Link href="#dang-ky" className="btn-primary mt-8">Đăng ký tư vấn <ArrowRight size={17} /></Link>
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden bg-[#0b3157] py-20 text-white md:py-24">
        <div className="container-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <Reveal><h2 className="text-3xl font-extrabold leading-tight tracking-[-.035em] md:text-5xl">Một hành trình học<br />đơn giản và rõ ràng.</h2><p className="mt-5 max-w-md leading-8 text-white/75">Từ lúc tìm hiểu khóa học đến khi theo dõi tiến độ, phụ huynh và học viên đều có thông tin cần thiết ở đúng nơi.</p></Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {[[ShieldCheck,"Lộ trình có cấu trúc","Nội dung được tổ chức theo chương trình và cấp độ."],[Users,"Lớp học phù hợp","Quy mô lớp và lịch học được tư vấn theo nhu cầu."],[ClipboardCheck,"Theo dõi tiến độ","Kết quả học tập được ghi nhận trên hệ thống."],[MessageCircle,"Kết nối phụ huynh","Thông tin khóa học và tư vấn được trình bày rõ ràng."]].map(([Icon,title,text], index) => { const I = Icon as typeof ShieldCheck; return <Reveal key={String(title)} delay={index * 80}><div className="h-full rounded-2xl border border-white/12 bg-white/[.06] p-6 transition hover:-translate-y-1 hover:bg-white/[.1]"><I className="text-[#ff646c]" size={27} /><h3 className="mt-5 font-extrabold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-white/65">{String(text)}</p></div></Reveal>; })}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container-shell">
          <Reveal className="mx-auto max-w-3xl text-center"><h2 className="section-title">Lắng nghe từ học viên và phụ huynh</h2><p className="mt-4 text-sm text-slate-500">Nội dung minh họa — sẽ thay bằng phản hồi thực tế sau khi trung tâm xác nhận.</p></Reveal>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
            {["Giáo viên hướng dẫn rõ từng bước nên con dễ theo bài và chủ động hơn khi học ở nhà.","Phụ huynh có thể nắm được chương trình, lịch học và hướng tiến bộ của học viên."].map((quote, index) => <Reveal key={quote} delay={index * 100}><article className="soft-card relative h-full p-8 md:p-10"><Quote className="text-[#d91f2a]" size={34} /><p className="mt-5 text-base font-medium leading-8 text-slate-700">“{quote}”</p><div className="mt-7 border-t border-slate-100 pt-5"><strong className="text-sm text-[#092b4c]">Phản hồi minh họa {index + 1}</strong><span className="mt-1 block text-xs text-slate-500">Dữ liệu mẫu chờ xác nhận</span></div></article></Reveal>)}
          </div>
        </div>
      </section>

      <section id="tin-tuc" className="bg-[#f5f7fa] py-20 md:py-28">
        <div className="container-shell">
          <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><h2 className="section-title">Tin tức và kinh nghiệm</h2><Link href="#" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#123d68]">Xem tất cả <ArrowRight size={17} /></Link></Reveal>
          <div className="mt-11 grid gap-7 md:grid-cols-3">
            {news.map((item, index) => <Reveal key={item.title} delay={index * 90}><article className="soft-card image-zoom group h-full overflow-hidden"><div className="relative h-56 overflow-hidden"><Image src={item.image} alt="Ảnh minh họa bài viết" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" /></div><div className="p-7"><div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-[#d91f2a]"><span>{item.tag}</span><span className="text-slate-300">•</span><span className="text-slate-500">{item.date}</span></div><h3 className="mt-4 text-lg font-extrabold leading-7 text-[#092b4c] transition-colors group-hover:text-[#d91f2a]">{item.title}</h3><Link href="#" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#123d68]">Đọc thêm <ChevronRight size={16} /></Link></div></article></Reveal>)}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24"><div className="container-shell"><Reveal className="text-center"><h2 className="section-title">Phục vụ học viên tại Hà Nội và Hưng Yên</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Địa chỉ cụ thể và bản đồ sẽ được cập nhật sau khi trung tâm xác nhận.</p></Reveal><div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">{["Hà Nội","Hưng Yên"].map((place,index)=><Reveal key={place} delay={index*90}><div className="soft-card flex items-center gap-5 p-6 transition hover:-translate-y-1"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#edf3f8] text-[#123d68]"><MapPin /></span><div><span className="text-xs font-bold uppercase tracking-wider text-[#d91f2a]">Khu vực {index+1}</span><h3 className="mt-1 text-xl font-extrabold text-[#092b4c]">{place}</h3><p className="mt-1 text-xs text-slate-500">Địa chỉ đang chờ xác nhận</p></div></div></Reveal>)}</div></div></section>

      <section id="dang-ky" className="bg-[#0b3157] py-20 md:py-24"><div className="container-shell"><Reveal className="overflow-hidden rounded-[24px] bg-white shadow-2xl lg:grid lg:grid-cols-[.8fr_1.2fr]"><div className="bg-[#d91f2a] p-8 text-white md:p-12"><h2 className="text-3xl font-extrabold leading-tight tracking-[-.03em] md:text-4xl">Tìm chương trình phù hợp cho học viên.</h2><p className="mt-5 leading-7 text-white">Để lại thông tin để trung tâm trao đổi về trình độ, mục tiêu và lịch học.</p><div className="mt-8 grid gap-4 text-sm font-bold">{["Tư vấn theo độ tuổi và mục tiêu","Hẹn lịch đánh giá đầu vào","Thông tin được bảo mật"].map(x=><span key={x} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20"><Check size={15}/></span>{x}</span>)}</div></div><div className="p-8 md:p-12"><LeadForm /></div></Reveal></div></section>
    </>
  );
}
