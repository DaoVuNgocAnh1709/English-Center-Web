import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, HeartHandshake, Route, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Về trung tâm" };

const values = [
  [HeartHandshake, "Thấu hiểu học viên", "Thiết kế trải nghiệm học phù hợp từng giai đoạn."],
  [Route, "Lộ trình rõ ràng", "Mục tiêu và nội dung được chia thành các chặng dễ theo dõi."],
  [ShieldCheck, "Vận hành tin cậy", "Bảo vệ dữ liệu và xây dựng hệ thống có khả năng mở rộng."],
] as const;

export default function AboutPage() {
  return <>
    <PageHero kicker="Về Bright Path" title="Một môi trường để học viên tiến bộ bằng sự tự tin" description="Bright Path hướng tới chương trình rõ ràng, trải nghiệm học gần gũi và sự phối hợp thuận tiện giữa trung tâm, giáo viên và phụ huynh." />
    <section className="py-20 md:py-28">
      <div className="container-shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="overflow-hidden rounded-[22px]"><Image src="/images/learning-project.png" width={1200} height={900} alt="Hoạt động học tập tại trung tâm" className="aspect-[4/3] w-full object-cover" /></div>
        <div>
          <h2 className="section-title">Học chắc nền tảng,<br />ứng dụng trong thực tế</h2>
          <p className="mt-6 leading-8 text-slate-600">Trung tâm hiện phục vụ khoảng 100 học viên và định hướng mở rộng tại Hà Nội, Hưng Yên. Website giúp chuẩn hóa thông tin khóa học, học liệu và hành trình chăm sóc học viên.</p>
          <div className="mt-7 grid gap-4">{["Lộ trình phù hợp độ tuổi và mục tiêu", "Tài liệu học tập được tổ chức tập trung", "Phụ huynh dễ theo dõi và liên hệ"].map((item) => <span key={item} className="flex items-center gap-3 text-sm font-bold"><Check className="text-[#d91f2a]" size={19} />{item}</span>)}</div>
          <Link href="/lien-he" className="btn-primary mt-8">Đăng ký tư vấn <ArrowRight size={17} /></Link>
        </div>
      </div>
    </section>
    <section className="bg-[#f5f7fa] py-20">
      <div className="container-shell grid gap-6 md:grid-cols-3">{values.map(([Icon, title, text]) => <article key={title} className="soft-card p-8"><Icon className="text-[#d91f2a]" /><h2 className="mt-5 text-xl font-extrabold text-[#092b4c]">{title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}</div>
    </section>
  </>;
}
