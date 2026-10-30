import { Injectable, NotFoundException } from "@nestjs/common";
import { CourseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  findPublished() {
    return this.prisma.course.findMany({ where: { status: CourseStatus.PUBLISHED }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, title: true, ageRange: true, summary: true, level: true, duration: true, thumbnailUrl: true } });
  }
  async findOnePublished(slug: string) {
    const course = await this.prisma.course.findFirst({ where: { slug, status: CourseStatus.PUBLISHED }, include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, summary: true, sortOrder: true, isPreview: true, youtubeUrl: true } } } });
    if (!course) throw new NotFoundException("Không tìm thấy khóa học.");
    return course;
  }
}

