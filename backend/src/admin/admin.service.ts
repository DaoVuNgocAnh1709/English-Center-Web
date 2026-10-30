import { BadRequestException, Injectable } from "@nestjs/common";
import { LeadStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
  updateLead(id: string, status: LeadStatus) {
    if (!Object.values(LeadStatus).includes(status)) throw new BadRequestException("Trạng thái không hợp lệ.");
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }
}
