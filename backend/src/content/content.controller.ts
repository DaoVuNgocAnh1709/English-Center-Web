import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ContentStatus, QuestionKind, QuestionTaskType, Role, SchoolLevel } from "@prisma/client";
import { Response, Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AccessPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { ContentService, Upload } from "./content.service";
import { JwtService } from "@nestjs/jwt";
import { Req } from "@nestjs/common";

function validLevel(value?: string): SchoolLevel | undefined {
  if (!value) return undefined;
  if (!Object.values(SchoolLevel).includes(value as SchoolLevel))
    throw new BadRequestException("Cấp học không hợp lệ.");
  return value as SchoolLevel;
}
function validGrade(value?: string): number | undefined {
  if (!value) return undefined;
  const grade = Number(value);
  if (!Number.isInteger(grade) || grade < 0 || grade > 12)
    throw new BadRequestException("Lớp không hợp lệ.");
  return grade;
}

@Controller("staff/content")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class StaffContentController {
  constructor(private readonly service: ContentService) {}
  @Get("sources") sources(@CurrentUser() user: AccessPayload) {
    return this.service.sources(user.sub, user.role);
  }
  @Get("exam-template") async examTemplate(@Res() res: Response) {
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .setHeader("Content-Disposition", "attachment; filename=bright-path-exam-template.xlsx")
      .send(await this.service.examTemplate());
  }
  @Post("sources")
  @UseInterceptors(
    FilesInterceptor("file", 20, { limits: { fileSize: 15 * 1024 * 1024, files: 20 } }),
  )
  uploadSource(
    @UploadedFiles() files: Upload[],
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.uploadSources(files, user.sub);
  }
  @Get("storage") storage() {
    return this.service.storageStats();
  }
  @Get("recognition-learning") recognitionLearning(
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.recognitionLearningStats(user.sub, user.role);
  }
  @Get("recognition-learning/export") async recognitionLearningExport(
    @CurrentUser() user: AccessPayload,
    @Res() res: Response,
  ) {
    const data = await this.service.recognitionLearningExport(user.sub, user.role);
    res
      .type("application/x-ndjson")
      .setHeader(
        "Content-Disposition",
        `attachment; filename=recognition-corrections-${new Date().toISOString().slice(0, 10)}.jsonl`,
      )
      .send(data);
  }
  @Post("sources/:id/retry") retrySource(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.retrySource(id, user.sub, user.role);
  }
  @Delete("sources/:id") deleteSource(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.deleteSource(id, user.sub, user.role);
  }
  @Get("exams") exams(@CurrentUser() user: AccessPayload) {
    return this.service.staffExams(user.sub, user.role);
  }
  @Get("attempts") attempts(@CurrentUser() user: AccessPayload) {
    return this.service.staffAttempts(user.sub, user.role);
  }
  @Patch("attempts/:id/grade") gradeAttempt(
    @Param("id") id: string,
    @Body() body: { scores: Record<string, number>; feedback?: string },
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.gradeAttempt(
      id,
      body.scores,
      body.feedback,
      user.sub,
      user.role,
    );
  }
  @Post("exams") createExam(
    @Body()
    body: {
      sourceId: string;
      title: string;
      summary?: string;
      schoolLevel: string;
      grade: number;
      startPage: number;
      endPage: number;
      durationMinutes?: number;
      answerText?: string;
      extractQuestions?: boolean;
      showAnswers?: boolean;
    },
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.createExam(body, user.sub, user.role);
  }
  @Patch("exams/:id/answer-visibility") examAnswerVisibility(
    @Param("id") id: string,
    @Body("showAnswers") showAnswers: boolean,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.setExamAnswerVisibility(
      id,
      Boolean(showAnswers),
      user.sub,
      user.role,
    );
  }
  @Patch("exams/:id/keys") keys(
    @Param("id") id: string,
    @Body("answerText") answerText: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.updateKeys(id, answerText || "", user.sub, user.role);
  }
  @Post("exams/:id/extract") extract(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.extractExamQuestions(id, user.sub, user.role);
  }
  @Patch("exams/:id/questions") question(
    @Param("id") id: string,
    @Body()
    body: {
      position: number;
      answer?: string;
      kind?: QuestionKind;
      taskType?: QuestionTaskType;
      points?: number;
      content?: string;
      section?: string;
      options?: string[];
      interactionData?: {
        matchingLeft?: string[];
        matchingRight?: string[];
        orderingItems?: string[];
      } | null;
    },
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.upsertQuestion(id, body, user.sub, user.role);
  }
  @Post("exams/:id/questions/confirm-trusted") confirmTrustedQuestions(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.confirmTrustedQuestions(id, user.sub, user.role);
  }
  @Delete("exams/:id/questions/:position") removeQuestion(
    @Param("id") id: string,
    @Param("position") position: string,
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.deleteQuestion(
      id,
      Number(position),
      user.sub,
      user.role,
    );
  }
  @Patch("exams/:id/status") examStatus(
    @Param("id") id: string,
    @Body("status") status: ContentStatus,
    @CurrentUser() user: AccessPayload,
  ) {
    if (!Object.values(ContentStatus).includes(status))
      throw new BadRequestException();
    return this.service.setExamStatus(id, status, user.sub, user.role);
  }
  @Get("exams/:id/file") async file(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
    @Res() res: Response,
  ) {
    const file = await this.service.examFile(id, user.sub, user.role);
    res
      .type(file.mime)
      .setHeader(
        "Content-Disposition",
        file.mime === "application/pdf" || file.mime.startsWith("image/")
          ? "inline"
          : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    file.stream.pipe(res);
  }
  @Get("materials") materials(@CurrentUser() user: AccessPayload) {
    return this.service.staffMaterials(user.sub, user.role);
  }
  @Get("materials/:id/file") async staffMaterialFile(
    @Param("id") id: string,
    @CurrentUser() user: AccessPayload,
    @Res() res: Response,
  ) {
    const file = await this.service.staffMaterialFile(id, user.sub, user.role);
    res
      .type(file.mime)
      .setHeader(
        "Content-Disposition",
        file.mime === "application/pdf"
          ? "inline"
          : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    file.stream.pipe(res);
  }
  @Post("materials")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  uploadMaterial(
    @UploadedFile() file: Upload,
    @Body()
    body: {
      title: string;
      summary: string;
      category: string;
      schoolLevel: string;
      grade: number;
    },
    @CurrentUser() user: AccessPayload,
  ) {
    return this.service.uploadMaterial(file, body, user.sub);
  }
  @Patch("materials/:id/status") materialStatus(
    @Param("id") id: string,
    @Body("status") status: ContentStatus,
    @CurrentUser() user: AccessPayload,
  ) {
    if (!Object.values(ContentStatus).includes(status))
      throw new BadRequestException();
    return this.service.setMaterialStatus(id, status, user.sub, user.role);
  }
}

@Controller("public-content")
export class PublicContentController {
  constructor(
    private readonly service: ContentService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  private async userId(req: Request) {
    const cookie = req.cookies?.access_token;
    if (!cookie) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(cookie, {
        secret: process.env.JWT_ACCESS_SECRET!,
      });
      if (payload.sessionId) {
        const session = await this.prisma.refreshSession.findUnique({
          where: { id: payload.sessionId },
          select: { revokedAt: true, expiresAt: true },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
          return undefined;
        }
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });
      return user?.isActive ? user.id : undefined;
    } catch {
      return undefined;
    }
  }
  @Get("exams") exams(
    @Query("level") level?: string,
    @Query("grade") grade?: string,
  ) {
    return this.service.publicExams(validLevel(level), validGrade(grade));
  }
  @Get("exams/:slug") exam(@Param("slug") slug: string) {
    return this.service.publicExam(slug);
  }
  @Get("exams/:id/file") async examFile(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const file = await this.service.examFile(id);
    res
      .type(file.mime)
      .setHeader(
        "Content-Disposition",
        file.mime === "application/pdf" || file.mime.startsWith("image/")
          ? "inline"
          : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    file.stream.pipe(res);
  }
  @Post("exams/:id/attempts/start") startAttempt(
    @Param("id") id: string,
    @Body()
    body: {
      participantName?: string;
      attemptId?: string;
      guestToken?: string;
      forceNew?: boolean;
      preferNew?: boolean;
    },
    @Req() req: Request,
  ) {
    return this.userId(req).then((userId) =>
      this.service.startAttempt(id, body || {}, userId),
    );
  }
  @Patch("exams/:id/attempts/:attemptId") saveAttempt(
    @Param("id") id: string,
    @Param("attemptId") attemptId: string,
    @Body() body: { answers: Record<string, string>; guestToken?: string },
    @Req() req: Request,
  ) {
    return this.userId(req).then((userId) =>
      this.service.saveAttempt(
        id,
        attemptId,
        body.answers,
        userId,
        body.guestToken,
      ),
    );
  }
  @Post("exams/:id/attempts/:attemptId/submit") submitAttempt(
    @Param("id") id: string,
    @Param("attemptId") attemptId: string,
    @Body() body: { answers: Record<string, string>; guestToken?: string },
    @Req() req: Request,
  ) {
    return this.userId(req).then((userId) =>
      this.service.submitAttempt(
        id,
        attemptId,
        body.answers,
        userId,
        body.guestToken,
      ),
    );
  }
  @Get("materials") materials(
    @Query("level") level?: string,
    @Query("grade") grade?: string,
  ) {
    return this.service.publicMaterials(validLevel(level), validGrade(grade));
  }
  @Get("materials/:slug") material(@Param("slug") slug: string) {
    return this.service.publicMaterial(slug);
  }
  @Get("materials/:id/file") async materialFile(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const file = await this.service.materialFile(id);
    res
      .type(file.mime)
      .setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    file.stream.pipe(res);
  }
  @Get("materials/:id/preview") async materialPreview(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const file = await this.service.materialFile(id);
    if (file.mime !== "application/pdf") {
      file.stream.destroy();
      throw new BadRequestException("Chỉ xem trước PDF.");
    }
    res
      .type("application/pdf")
      .setHeader("Content-Disposition", "inline");
    file.stream.pipe(res);
  }
  @Post("teacher-applications") async apply(
    @Body()
    body: {
      fullName: string;
      email: string;
      phone: string;
      area: string;
      experience: string;
      message?: string;
    },
  ) {
    const item = await this.service.apply(body);
    return { id: item.id, received: true };
  }
}

@Controller("admin/content")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminContentController {
  constructor(private readonly service: ContentService) {}
  @Get("applications") applications() {
    return this.service.applications();
  }
  @Patch("applications/:id/status") status(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.service.setApplicationStatus(id, status);
  }
}

@Controller("student/content")
@UseGuards(JwtAuthGuard)
export class StudentContentController {
  constructor(private readonly service: ContentService) {}
  @Get("history") history(@CurrentUser() user: AccessPayload) {
    return this.service.history(user.sub);
  }
}
