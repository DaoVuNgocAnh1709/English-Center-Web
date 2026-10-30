import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}
  findPublic(category?: string) {
    return this.prisma.material.findMany({
      where: { isPublic: true, ...(category ? { category } : {}) },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, title: true, summary: true, category: true, level: true, type: true, driveUrl: true, youtubeUrl: true, publishedAt: true },
    });
  }
}
