import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaterialDto } from "./dto/create-material.dto";
import { AccessPayload } from "../auth/auth.types";

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}
  materials() { return this.prisma.material.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }); }
  async createMaterial(dto: CreateMaterialDto, user: AccessPayload) {
    const base = dto.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "hoc-lieu";
    const slug = `${base}-${Date.now().toString(36)}`;
    return this.prisma.material.create({ data: { ...dto, slug, isPublic: false, status: "DRAFT", publishedAt: null, createdById: user.sub } });
  }
}
