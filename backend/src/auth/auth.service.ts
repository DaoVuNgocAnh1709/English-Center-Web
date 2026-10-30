import { createHash, randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccessPayload, RefreshPayload } from "./auth.types";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");
    return this.createSession(user.id, user.email, user.role);
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException("Thiếu refresh token.");
    let payload: RefreshPayload;
    try { payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, { secret: process.env.JWT_REFRESH_SECRET! }); }
    catch { throw new UnauthorizedException("Refresh token không hợp lệ."); }

    const session = await this.prisma.refreshSession.findUnique({ where: { id: payload.sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.tokenHash !== this.hashToken(rawToken) || !session.user.isActive) throw new UnauthorizedException("Phiên đăng nhập không còn hiệu lực.");
    await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.createSession(session.user.id, session.user.email, session.user.role);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, { secret: process.env.JWT_REFRESH_SECRET!, ignoreExpiration: true });
      await this.prisma.refreshSession.updateMany({ where: { id: payload.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    } catch { return; }
  }

  private async createSession(userId: string, email: string, role: AccessPayload["role"]) {
    const sessionId = randomUUID();
    const accessPayload: AccessPayload = { sub: userId, email, role, sessionId };
    const refreshPayload: RefreshPayload = { sub: userId, sessionId, type: "refresh" };
    const accessToken = await this.jwt.signAsync(accessPayload, { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: process.env.JWT_ACCESS_TTL as never });
    const refreshToken = await this.jwt.signAsync(refreshPayload, { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: process.env.JWT_REFRESH_TTL as never });
    const refreshDays = Number(process.env.JWT_REFRESH_DAYS);
    await this.prisma.refreshSession.create({ data: { id: sessionId, tokenHash: this.hashToken(refreshToken), userId, expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000) } });
    return { accessToken, refreshToken };
  }
}

