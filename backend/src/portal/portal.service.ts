import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AccessPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}
  async overview(payload: AccessPayload) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub }, select: { id: true, email: true, fullName: true, role: true } });
    if (user.role === Role.STUDENT) {
      const enrollments = await this.prisma.enrollment.findMany({ where: { userId: user.id }, include: { course: { select: { slug: true, title: true, ageRange: true, lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, summary: true, driveUrl: true, youtubeUrl: true } } } } }, orderBy: { updatedAt: "desc" } });
      return { user, enrollments, metrics: { courses: enrollments.length, averageProgress: enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + item.progress, 0) / enrollments.length) : 0 } };
    }
    const [courses, materials, leads] = await Promise.all([this.prisma.course.count(), this.prisma.material.count(), this.prisma.lead.count({ where: { status: "NEW" } })]);
    return { user, metrics: { courses, materials, newLeads: leads } };
  }
}
