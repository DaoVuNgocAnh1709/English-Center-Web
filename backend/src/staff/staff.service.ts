import { Injectable } from "@nestjs/common";
import { Role, SchoolLevel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaterialDto } from "./dto/create-material.dto";
import { AccessPayload } from "../auth/auth.types";

function parseLevelAndGrade(levelText?: string): { schoolLevel?: SchoolLevel; grade?: number } {
  if (!levelText) return {};
  const normalized = levelText.trim().toLowerCase();
  if (normalized.includes("mầm non")) return { schoolLevel: SchoolLevel.PRESCHOOL, grade: 0 };
  const match = normalized.match(/lớp\s*(\d+)/);
  if (match) {
    const grade = Number(match[1]);
    if (grade >= 1 && grade <= 5) return { schoolLevel: SchoolLevel.PRIMARY, grade };
    if (grade >= 6 && grade <= 9) return { schoolLevel: SchoolLevel.MIDDLE, grade };
    if (grade >= 10 && grade <= 12) return { schoolLevel: SchoolLevel.HIGH, grade };
  }
  return {};
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}
  materials(user: AccessPayload) {
    return this.prisma.material.findMany({
      where: user.role === Role.ADMIN ? {} : { createdById: user.sub },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }
  async createMaterial(dto: CreateMaterialDto, user: AccessPayload) {
    const base = dto.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "hoc-lieu";
    const slug = `${base}-${Date.now().toString(36)}`;
    const { schoolLevel, grade } = parseLevelAndGrade(dto.level);
    return this.prisma.material.create({
      data: {
        ...dto,
        schoolLevel,
        grade,
        slug,
        isPublic: false,
        status: "DRAFT",
        publishedAt: null,
        createdById: user.sub,
      },
    });
  }
}
