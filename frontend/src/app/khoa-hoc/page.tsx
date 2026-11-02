import { CourseCard } from "@/components/course-card";
import { PageHero } from "@/components/page-hero";
import { courses as staticCourses } from "@/lib/site-data";

export const metadata = { title: "Chương trình học" };

type ApiCourse = {
  slug: string;
  title: string;
  ageRange: string;
  level: string | null;
  duration: string | null;
  summary: string;
};

async function loadCourses() {
  const apiUrl = process.env.INTERNAL_API_URL || "http://backend:4000/api";
  try {
    const response = await fetch(`${apiUrl}/courses`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as ApiCourse[];
    if (!data.length) return staticCourses;
    return data.map((item) => ({
      slug: item.slug,
      title: item.title,
      age: item.ageRange,
      level: item.level || "Chương trình",
      duration: item.duration || "Theo lộ trình",
      summary: item.summary,
    }));
  } catch {
    return staticCourses;
  }
}

export default async function CoursesPage() {
  const courseList = await loadCourses();
  return (
    <>
      <PageHero
        kicker="Chương trình đào tạo"
        title="Lộ trình phù hợp với từng giai đoạn học tập"
        description="Từ nền tảng ban đầu đến củng cố học thuật và luyện thi học kỳ, mỗi chương trình có mục tiêu và nội dung rõ ràng."
      />
      <section className="bg-[#f3f6fa] py-16 md:py-20">
        <div className="container-shell">
          <div className="surface-panel overflow-hidden px-6 md:px-9">
            {courseList.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
