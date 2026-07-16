import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export interface AuditEvent {
  ts: string;
  action: string;
  username?: string;
  meta?: Record<string, unknown>;
}

function todayFile(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(config.auditDir, `${day}.jsonl`);
}

export function appendAudit(
  action: string,
  username?: string,
  meta?: Record<string, unknown>,
): void {
  fs.mkdirSync(config.auditDir, { recursive: true });
  const event: AuditEvent = {
    ts: new Date().toISOString(),
    action,
    username,
    meta,
  };
  fs.appendFileSync(todayFile(), `${JSON.stringify(event)}\n`, "utf8");
}

export function readAuditTail(limit = 100): AuditEvent[] {
  fs.mkdirSync(config.auditDir, { recursive: true });
  const files = fs
    .readdirSync(config.auditDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse();

  const events: AuditEvent[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(config.auditDir, file), "utf8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .reverse();
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as AuditEvent);
      } catch {
        // skip bad lines
      }
      if (events.length >= limit) return events;
    }
  }
  return events;
}
