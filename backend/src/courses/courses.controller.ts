import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CoursesService } from "./courses.service";

@ApiTags("courses")
@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get()
  findPublished() { return this.courses.findPublished(); }
  @Get(":slug")
  findOne(@Param("slug") slug: string) { return this.courses.findOnePublished(slug); }
}

