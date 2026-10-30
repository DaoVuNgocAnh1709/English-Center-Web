import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AccessPayload } from "../auth/auth.types";
import { PortalService } from "./portal.service";

@ApiTags("portal")
@Controller("portal")
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}
  @Get("overview")
  overview(@CurrentUser() user: AccessPayload) { return this.portal.overview(user); }
}
