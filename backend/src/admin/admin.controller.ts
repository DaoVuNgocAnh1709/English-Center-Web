import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { LeadStatus, Role } from "@prisma/client";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get("overview") overview() { return this.admin.overview(); }
  @Get("leads") leads() { return this.admin.leads(); }
  @Patch("leads/:id/:status") updateLead(@Param("id") id: string, @Param("status") status: LeadStatus) { return this.admin.updateLead(id, status); }
}
