import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadsService } from "./leads.service";

@ApiTags("leads")
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateLeadDto) {
    const lead = await this.leads.create(dto);
    return { id: lead.id, message: "Đã nhận thông tin đăng ký." };
  }
}

