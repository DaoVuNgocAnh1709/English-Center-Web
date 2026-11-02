import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseStatus, EnrollmentStatus, LeadStatus, Role } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";

function normalizeExternalUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException("Đường dẫn liên kết chỉ hỗ trợ giao thức http:// hoặc https://.");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Đường dẫn liên kết không hợp lệ.");
  }
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async overview() {
    const [students, courses, materials, leads] = await Promise.all([
      this.prisma.user.count({ where: { role: "STUDENT", isActive: true } }), this.prisma.course.count(), this.prisma.material.count(), this.prisma.lead.count({ where: { status: "NEW" } }),
    ]);
    return { students, courses, materials, newLeads: leads };
  }
  leads() { return this.prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 }); }
  async updateLead(id: string, status: LeadStatus) {
    if (!Object.values(LeadStatus).includes(status)) throw new BadRequestException("Trạng thái không hợp lệ.");
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Không tìm thấy yêu cầu tư vấn.");
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }

  courses() {
    return this.prisma.course.findMany({
      include: {
        lessons: { orderBy: { sortOrder: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async createCourse(body: {
    title: string;
    ageRange?: string;
    category?: string;
    level?: string;
    duration?: string;
    summary: string;
    description?: string;
    status?: CourseStatus;
  }) {
    const ageRange = (body?.ageRange || body?.category || "").trim();
    if (!body?.title?.trim() || !ageRange || !body?.summary?.trim()) {
      throw new BadRequestException("Vui lòng nhập đầy đủ tên khóa học, độ tuổi và mô tả ngắn.");
    }
    const base = body.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "khoa-hoc";
    const slug = `${base}-${Date.now().toString(36)}`;
    return this.prisma.course.create({
      data: {
        slug,
        title: body.title.trim().slice(0, 160),
        ageRange: ageRange.slice(0, 80),
        level: body.level?.trim().slice(0, 80) || "Chương trình",
        duration: body.duration?.trim().slice(0, 80) || "Theo lộ trình",
        summary: body.summary.trim().slice(0, 300),
        description: body.description?.trim().slice(0, 2000) || body.summary.trim().slice(0, 300),
        status: body.status && Object.values(CourseStatus).includes(body.status) ? body.status : CourseStatus.PUBLISHED,
      },
    });
  }

  async updateCourseStatus(id: string, status: CourseStatus) {
    if (!Object.values(CourseStatus).includes(status)) {
      throw new BadRequestException("Trạng thái khóa học không hợp lệ.");
    }
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Không tìm thấy khóa học.");
    return this.prisma.course.update({ where: { id }, data: { status } });
  }

  async addLesson(courseId: string, body: { title: string; summary?: string; driveUrl?: string; youtubeUrl?: string }) {
    if (!body?.title?.trim()) throw new BadRequestException("Vui lòng nhập tên bài học.");
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, include: { lessons: true } });
    if (!course) throw new NotFoundException("Không tìm thấy khóa học.");
    return this.prisma.lesson.create({
      data: {
        courseId,
        title: body.title.trim().slice(0, 160),
        summary: body.summary?.trim().slice(0, 300) || null,
        driveUrl: normalizeExternalUrl(body.driveUrl),
        youtubeUrl: normalizeExternalUrl(body.youtubeUrl),
        sortOrder: course.lessons.length + 1,
      },
    });
  }

  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        enrollments: {
          include: { course: { select: { id: true, title: true, slug: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createUser(body: { email: string; fullName: string; password: string; role: Role }) {
    const email = body?.email?.trim().toLowerCase();
    const fullName = body?.fullName?.trim();
    const password = body?.password;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException("Email không hợp lệ.");
    }
    if (!fullName || fullName.length < 2) {
      throw new BadRequestException("Họ và tên phải có ít nhất 2 ký tự.");
    }
    if (!password || password.length < 8) {
      throw new BadRequestException("Mật khẩu phải có ít nhất 8 ký tự.");
    }
    if (!Object.values(Role).includes(body.role)) {
      throw new BadRequestException("Vai trò không hợp lệ.");
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email này đã tồn tại trong hệ thống.");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.prisma.user.create({
      data: { email, fullName: fullName.slice(0, 120), passwordHash, role: body.role },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
  }

  async enrollStudent(body: { userId: string; courseId: string; progress?: number; progressPercent?: number }) {
    if (!body?.userId || !body?.courseId) {
      throw new BadRequestException("Vui lòng chọn học viên và khóa học.");
    }
    const rawProgress = Number(body.progress ?? body.progressPercent ?? 0);
    if (!Number.isFinite(rawProgress)) {
      throw new BadRequestException("Tiến độ học tập không hợp lệ.");
    }
    const [user, course] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: body.userId } }),
      this.prisma.course.findUnique({ where: { id: body.courseId } }),
    ]);
    if (!user) throw new NotFoundException("Không tìm thấy học viên.");
    if (!course) throw new NotFoundException("Không tìm thấy khóa học.");
    const progress = Math.min(100, Math.max(0, Math.round(rawProgress)));
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: body.userId, courseId: body.courseId } },
      update: { progress, status: EnrollmentStatus.ACTIVE },
      create: { userId: body.userId, courseId: body.courseId, progress, status: EnrollmentStatus.ACTIVE },
    });
  }
}
