import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AccessPayload } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AccessPayload }>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: process.env.JWT_ACCESS_SECRET! });
    } catch {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn.");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    }
    if (payload.sessionId) {
      const session = await this.prisma.refreshSession.findUnique({
        where: { id: payload.sessionId },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException("Phiên đăng nhập đã kết thúc.");
      }
    }
    request.user = { ...payload, email: user.email, role: user.role };
    return true;
  }
}

