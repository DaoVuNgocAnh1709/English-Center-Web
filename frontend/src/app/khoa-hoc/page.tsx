import { CourseCard } from "@/components/course-card";
import { PageHero } from "@/components/page-hero";
import { courses } from "@/lib/site-data";

export const metadata = { title: "Chương trình học" };
export default function CoursesPage() { return <><PageHero kicker="Chương trình đào tạo" title="Lộ trình phù hợp với từng giai đoạn học tập" description="Từ nền tảng ban đầu đến củng cố học thuật và luyện thi học kỳ, mỗi chương trình có mục tiêu và nội dung rõ ràng."/><section className="bg-[#f3f6fa] py-16 md:py-20"><div className="container-shell"><div className="surface-panel overflow-hidden px-6 md:px-9">{courses.map(course=><CourseCard key={course.slug} course={course}/>)}</div></div></section></> }
