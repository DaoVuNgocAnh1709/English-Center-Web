import { Test } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  it("is defined", async () => {
    const module = await Test.createTestingModule({ imports: [JwtModule.register({})], providers: [AuthService, { provide: PrismaService, useValue: {} }] }).compile();
    expect(module.get(AuthService)).toBeDefined();
  });
});

