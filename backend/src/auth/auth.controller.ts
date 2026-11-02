import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AccessPayload } from "./auth.types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setCookies(response: Response, tokens: { accessToken: string; refreshToken: string }) {
    const secure = process.env.NODE_ENV === "production";
    response.cookie("access_token", tokens.accessToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 15 * 60 * 1000 });
    response.cookie("refresh_token", tokens.refreshToken, { httpOnly: true, secure, sameSite: "lax", path: "/api/auth", maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    this.setCookies(response, await this.auth.login(dto));
    return { message: "Đăng nhập thành công." };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.setCookies(response, await this.auth.refresh(request.cookies?.refresh_token));
    return { message: "Đã làm mới phiên đăng nhập." };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.refresh_token, request.cookies?.access_token);
    const secure = process.env.NODE_ENV === "production";
    response.clearCookie("access_token", { httpOnly: true, secure, sameSite: "lax", path: "/" });
    response.clearCookie("refresh_token", { httpOnly: true, secure, sameSite: "lax", path: "/api/auth" });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessPayload) { return user; }

  @Get("session")
  async session(@Req() request: Request) {
    return this.auth.session(request.cookies?.access_token);
  }
}

