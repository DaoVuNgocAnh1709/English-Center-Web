import { Role } from "@prisma/client";

export type AccessPayload = { sub: string; email: string; role: Role; sessionId: string };
export type RefreshPayload = { sub: string; sessionId: string; type: "refresh" };

