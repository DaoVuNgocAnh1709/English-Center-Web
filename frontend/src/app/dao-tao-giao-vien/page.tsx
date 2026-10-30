import { Award, BookMarked, Presentation } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { TeacherApplicationForm } from "@/components/teacher-application-form";

export const metadata = { title: "Đào tạo và tuyển giáo viên" };
export default function TeacherTrainingPage() {
  const items = [
    [
      Presentation,
      "Thiết kế bài giảng",
      "Xây dựng mục tiêu, hoạt động và đánh giá phù hợp từng nhóm học viên.",
    ],
    [
      BookMarked,
      "Phương pháp giảng dạy",
      "Chia sẻ phương pháp giao tiếp, dự án và phản hồi trong lớp học.",
    ],
    [
      Award,
      "Bồi dưỡng chuyên môn",
      "Workshop và kho học liệu cho đội ngũ giáo viên.",
    ],
  ] as const;
  return (
    <>
      <PageHero
        kicker="Đào tạo giáo viên"
        title="Cùng xây dựng đội ngũ giáo viên tiếng Anh"
        description="Tìm hiểu hướng đào tạo, cơ hội giảng dạy tại trung tâm và để lại thông tin nếu bạn muốn ứng tuyển."
      />
      <section className="bg-[#f3f6fa] py-16 md:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-extrabold text-[#092b4c]">Nội dung phát triển chuyên môn</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">Chương trình tập trung vào năng lực đứng lớp, thiết kế hoạt động và phản hồi học viên trong môi trường thực tế.</p>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {items.map(([Icon, title, description]) => (
              <article key={title} className="flex gap-4 py-6">
                <Icon className="mt-1 shrink-0 text-[#d91f2a]" size={24} />
                <div><h3 className="text-lg font-extrabold text-[#092b4c]">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{description}</p></div>
              </article>
            ))}
          </div>
          </div>
          <div className="surface-panel p-6 md:p-9 lg:sticky lg:top-24">
            <TeacherApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
