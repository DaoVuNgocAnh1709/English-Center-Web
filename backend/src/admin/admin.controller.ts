import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CourseStatus, LeadStatus, Role } from "@prisma/client";
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
  @Get("courses") courses() { return this.admin.courses(); }
  @Post("courses") createCourse(@Body() body: { title: string; ageRange?: string; category?: string; level?: string; duration?: string; summary: string; description?: string; status?: CourseStatus }) {
    return this.admin.createCourse(body);
  }
  @Patch("courses/:id/status") updateCourseStatus(@Param("id") id: string, @Body("status") status: CourseStatus) {
    return this.admin.updateCourseStatus(id, status);
  }
  @Post("courses/:id/lessons") addLesson(@Param("id") id: string, @Body() body: { title: string; summary?: string; driveUrl?: string; youtubeUrl?: string }) {
    return this.admin.addLesson(id, body);
  }
  @Get("users") users() { return this.admin.users(); }
  @Post("users") createUser(@Body() body: { email: string; fullName: string; password: string; role: Role }) {
    return this.admin.createUser(body);
  }
  @Post("enrollments") enrollStudent(@Body() body: { userId: string; courseId: string; progress?: number; progressPercent?: number }) {
    return this.admin.enrollStudent(body);
  }
}
