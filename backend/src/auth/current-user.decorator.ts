import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AccessPayload } from "./auth.types";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AccessPayload => context.switchToHttp().getRequest().user);

