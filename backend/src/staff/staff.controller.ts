import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { AccessPayload } from "../auth/auth.types";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateMaterialDto } from "./dto/create-material.dto";
import { StaffService } from "./staff.service";

@ApiTags("staff")
@Controller("staff")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Get("materials") materials() { return this.staff.materials(); }
  @Post("materials") createMaterial(@Body() dto: CreateMaterialDto, @CurrentUser() user: AccessPayload) { return this.staff.createMaterial(dto, user); }
}
