import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLeadDto } from "./dto/create-lead.dto";

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}
  create(data: CreateLeadDto) { return this.prisma.lead.create({ data }); }
}

