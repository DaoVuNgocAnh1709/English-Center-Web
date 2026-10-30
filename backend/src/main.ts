import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

function validateEnvironment() {
  const required = [
    "DATABASE_URL",
    "PORT",
    "NODE_ENV",
    "FRONTEND_ORIGIN",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_ACCESS_TTL",
    "JWT_REFRESH_TTL",
    "JWT_REFRESH_DAYS",
  ] as const;
  for (const name of required) {
    if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  }
  if (process.env.JWT_ACCESS_SECRET!.length < 32 || process.env.JWT_REFRESH_SECRET!.length < 32)
    throw new Error("JWT secrets must contain at least 32 characters.");
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET)
    throw new Error("JWT access and refresh secrets must be different.");
  if (!Number.isInteger(Number(process.env.PORT)) || Number(process.env.PORT) < 1)
    throw new Error("PORT must be a positive integer.");
  if (!Number.isFinite(Number(process.env.JWT_REFRESH_DAYS)) || Number(process.env.JWT_REFRESH_DAYS) <= 0)
    throw new Error("JWT_REFRESH_DAYS must be a positive number.");
}

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  // Nest's watch mode restarts the process with SIGTERM. Closing the HTTP
  // server and background import timer first prevents a stale worker from
  // continuing to serve old parser code on the same port.
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    const allowed = process.env.FRONTEND_ORIGIN!;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && origin !== allowed) {
      response.status(403).json({ message: "Origin không được phép." });
      return;
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN!, credentials: true });

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder().setTitle("English Center API").setDescription("MVP API").setVersion("0.1").addCookieAuth("access_token").build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(Number(process.env.PORT), "0.0.0.0");
}
bootstrap();

