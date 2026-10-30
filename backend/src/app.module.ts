import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CoursesModule } from "./courses/courses.module";
import { HealthController } from "./health.controller";
import { LeadsModule } from "./leads/leads.module";
import { PrismaModule } from "./prisma/prisma.module";
import { LibraryModule } from "./library/library.module";
import { PortalModule } from "./portal/portal.module";
import { AdminModule } from "./admin/admin.module";
import { StaffModule } from "./staff/staff.module";
import { ContentModule } from "./content/content.module";

@Module({ imports: [PrismaModule, AuthModule, CoursesModule, LeadsModule, LibraryModule, PortalModule, AdminModule, StaffModule, ContentModule], controllers: [HealthController] })
export class AppModule {}

