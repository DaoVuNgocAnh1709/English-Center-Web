import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthService } from "./auth.service";

@Module({ imports: [JwtModule.register({})], controllers: [AuthController], providers: [AuthService, JwtAuthGuard], exports: [JwtModule, AuthService, JwtAuthGuard] })
export class AuthModule {}

