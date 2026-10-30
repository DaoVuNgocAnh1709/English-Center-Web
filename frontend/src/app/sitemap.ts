import type { MetadataRoute } from "next";
import { courses } from "@/lib/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const pages = ["", "/gioi-thieu", "/khoa-hoc", "/luyen-de", "/thu-vien", "/dao-tao-giao-vien", "/tin-tuc", "/lien-he"];
  return [...pages.map((path, index) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: index === 0 ? 1 : .8 })), ...courses.map(course => ({ url: `${base}/khoa-hoc/${course.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: .8 }))];
}
