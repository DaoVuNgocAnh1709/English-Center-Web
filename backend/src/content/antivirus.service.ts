import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Socket } from "net";

export class MalwareDetectedError extends Error {}

@Injectable()
export class AntivirusService {
  async scan(buffer: Buffer) {
    const enabled = process.env.CLAMAV_ENABLED !== "false" && process.env.CLAMAV_REQUIRED !== "false";
    const host = process.env.CLAMAV_HOST?.trim();
    const port = Number(process.env.CLAMAV_PORT || 3310);
    const required = process.env.CLAMAV_REQUIRED === "true";
    if (!enabled || !host) {
      if (required && !host) throw new ServiceUnavailableException("Dịch vụ quét virus chưa được cấu hình.");
      return "SKIPPED" as const;
    }
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const socket = new Socket();
        let response = "";
        let transportError: Error | null = null;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          const cleaned = response.replace(/\0/g, "").trim();
          if (cleaned) resolve(cleaned);
          else reject(transportError || new Error("ClamAV closed without a response"));
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          reject(error);
        };
        socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS || 30000), () => fail(new Error("ClamAV timeout")));
        socket.on("error", (error) => { transportError = error; });
        socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
        socket.on("end", finish);
        socket.on("close", finish);
        socket.connect(port, host, () => {
          const packets: Buffer[] = [Buffer.from("zINSTREAM\0")];
          const chunkSize = 64 * 1024;
          for (let offset = 0; offset < buffer.length; offset += chunkSize) {
            const chunk = buffer.subarray(offset, Math.min(buffer.length, offset + chunkSize));
            const length = Buffer.alloc(4);
            length.writeUInt32BE(chunk.length);
            packets.push(length, chunk);
          }
          packets.push(Buffer.alloc(4));
          socket.end(Buffer.concat(packets));
        });
      });
      if (/FOUND$/i.test(result)) throw new MalwareDetectedError("Tệp bị cách ly vì phát hiện mã độc.");
      if (!/OK$/i.test(result)) throw new Error(`ClamAV: ${result || "no response"}`);
      return "CLEAN" as const;
    } catch (error) {
      if (error instanceof MalwareDetectedError) throw error;
      if (required) throw new ServiceUnavailableException("Không thể quét virus lúc này; vui lòng thử lại sau.");
      return "SKIPPED" as const;
    }
  }
}
