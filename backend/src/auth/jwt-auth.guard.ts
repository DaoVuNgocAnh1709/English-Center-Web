import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AccessPayload } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AccessPayload }>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
    try {
      request.user = await this.jwt.verifyAsync<AccessPayload>(token, { secret: process.env.JWT_ACCESS_SECRET! });
      return true;
    } catch {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn.");
    }
  }
}

