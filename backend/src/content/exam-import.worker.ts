import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ContentService } from "./content.service";

@Injectable()
export class ExamImportWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastCleanup = 0;
  private readonly logger = new Logger(ExamImportWorker.name);

  constructor(private readonly content: ContentService) {}

  onModuleInit() {
    if (process.env.IMPORT_WORKER_ENABLED === "false") return;
    const interval = Number(process.env.IMPORT_POLL_INTERVAL_MS || 1500);
    this.timer = setInterval(() => void this.tick(), interval);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const processedSource = await this.content.processNextSource();
      if (!processedSource) await this.content.processNextExam();
      if (Date.now() - this.lastCleanup > 24 * 60 * 60 * 1000) {
        this.lastCleanup = Date.now();
        await this.content.cleanupUnusedSources();
      }
    } catch (error) {
      this.logger.error("Import worker tick failed", error instanceof Error ? error.stack : String(error));
    }
    finally { this.running = false; }
  }
}
