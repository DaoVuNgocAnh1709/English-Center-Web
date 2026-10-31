import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import {
  AdminContentController,
  PublicContentController,
  StaffContentController,
  StudentContentController,
} from "./content.controller";
import { ContentService } from "./content.service";
import { AntivirusService } from "./antivirus.service";
import { ExamImportWorker } from "./exam-import.worker";
import { GeminiImportService } from "./gemini-import.service";

@Module({
  imports: [AuthModule],
  controllers: [
    StaffContentController,
    PublicContentController,
    AdminContentController,
    StudentContentController,
  ],
  providers: [ContentService, AntivirusService, GeminiImportService, ExamImportWorker],
})
export class ContentModule {}
