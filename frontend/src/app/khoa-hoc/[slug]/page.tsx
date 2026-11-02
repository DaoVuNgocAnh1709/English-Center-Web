import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Clock, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { courses as staticCourses } from "@/lib/site-data";

export function generateStaticParams() {
  return staticCourses.map(({ slug }) => ({ slug }));
}

type ApiCourseDetail = {
  slug: string;
  title: string;
  ageRange: string;
  level: string | null;
  duration: string | null;
  summary: string;
  description: string | null;
  lessons: {
    id: string;
    title: string;
    summary: string | null;
    sortOrder: number;
    isPreview: boolean;
    youtubeUrl: string | null;
  }[];
};

async function loadCourseDetail(slug: string) {
  const staticMatch = staticCourses.find((item) => item.slug === slug);
  const apiUrl = process.env.INTERNAL_API_URL || "http://backend:4000/api";
  try {
    const response = await fetch(`${apiUrl}/courses/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const apiData = (await response.json()) as ApiCourseDetail;
    return {
      slug: apiData.slug,
      title: apiData.title,
      age: apiData.ageRange,
      level: apiData.level || staticMatch?.level || "Chương trình",
      duration: apiData.duration || staticMatch?.duration || "Theo lộ trình",
      description: apiData.description || apiData.summary,
      outcomes: staticMatch?.outcomes || [
        "Củng cố kiến thức nền tảng và từ vựng theo chủ đề",
        "Thực hành phản xạ giao tiếp và kỹ năng làm bài",
        "Theo dõi tiến bộ định kỳ qua từng chặng học tập",
      ],
      lessons: apiData.lessons.length
        ? apiData.lessons.map((lesson) => ({
            title: lesson.title,
            summary:
              lesson.summary ||
              "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
          }))
        : [
            {
              title: "Khởi động và đánh giá nền tảng",
              summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
            },
            {
              title: "Học theo chủ đề và luyện tập",
              summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
            },
            {
              title: "Ôn tập, phản hồi và đánh giá tiến bộ",
              summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
            },
          ],
    };
  } catch {
    if (!staticMatch) return null;
    return {
      ...staticMatch,
      lessons: [
        {
          title: "Khởi động và đánh giá nền tảng",
          summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
        },
        {
          title: "Học theo chủ đề và luyện tập",
          summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
        },
        {
          title: "Ôn tập, phản hồi và đánh giá tiến bộ",
          summary: "Nội dung chi tiết được điều chỉnh theo lớp và kết quả đánh giá đầu vào.",
        },
      ],
    };
  }
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await loadCourseDetail(slug);
  if (!course) notFound();
  return (
    <>
      <PageHero
        kicker={course.level}
        title={course.title}
        description={course.description}
      />
      <section className="bg-[#f3f6fa] py-16 md:py-20">
        <div className="container-shell grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="surface-panel p-7 md:p-10">
            <h2 className="text-3xl font-extrabold text-[#092b4c]">
              Kết quả sau khóa học
            </h2>
            <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {course.outcomes.map((item) => (
                <div key={item} className="flex items-start gap-4 py-5">
                  <Check className="mt-0.5 shrink-0 text-[#d91f2a]" size={20} />
                  <strong className="text-sm leading-6 text-[#092b4c]">
                    {item}
                  </strong>
                </div>
              ))}
            </div>
            <h2 className="mt-12 text-2xl font-extrabold text-[#092b4c]">
              Cấu trúc chương trình
            </h2>
            <div className="mt-5">
              {course.lessons.map((item, index) => (
                <div
                  key={item.title}
                  className="workspace-step border-t border-slate-200 py-5 first:border-t-0"
                >
                  <span className="workspace-step-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong className="text-sm text-[#092b4c]">
                      {item.title}
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="h-fit rounded-[14px] bg-[#082f55] p-7 text-white shadow-[0_20px_50px_rgba(8,47,85,.2)] lg:sticky lg:top-24">
            <h2 className="text-xl font-extrabold">Thông tin khóa học</h2>
            <div className="mt-6 grid gap-4 text-sm">
              <span className="flex items-center gap-3">
                <Users size={18} className="text-[#ef5961]" />
                {course.age}
              </span>
              <span className="flex items-center gap-3">
                <Clock size={18} className="text-[#ef5961]" />
                {course.duration}
              </span>
            </div>
            <p className="mt-6 border-t border-white/15 pt-6 text-sm leading-7 text-white/75">
              Lịch học và học phí chính thức sẽ được tư vấn theo lớp phù hợp.
            </p>
            <Link href="/lien-he" className="btn-primary mt-6 w-full">
              Nhận tư vấn <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
