import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LibraryService } from "./library.service";

@ApiTags("library")
@Controller("library")
export class LibraryController {
  constructor(private readonly library: LibraryService) {}
  @Get()
  findPublic(@Query("category") category?: string) { return this.library.findPublic(category); }
}
