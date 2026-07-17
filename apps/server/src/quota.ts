import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

interface DayBucket {
  day: string;
  counts: Record<string, number>;
}

function quotaFile(): string {
  return path.join(config.projectRoot, "data/quota.json");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): DayBucket {
  try {
    if (!fs.existsSync(quotaFile())) {
      return { day: today(), counts: {} };
    }
    const raw = JSON.parse(fs.readFileSync(quotaFile(), "utf8")) as DayBucket;
    if (raw.day !== today()) return { day: today(), counts: {} };
    return raw;
  } catch {
    return { day: today(), counts: {} };
  }
}

function save(bucket: DayBucket): void {
  fs.mkdirSync(path.dirname(quotaFile()), { recursive: true });
  fs.writeFileSync(quotaFile(), JSON.stringify(bucket, null, 2), "utf8");
}

export function getQuota(username: string): {
  limit: number;
  used: number;
  remaining: number | null;
} {
  const limit = config.dailyMessageQuota;
  const bucket = load();
  const used = bucket.counts[username] ?? 0;
  return {
    limit,
    used,
    remaining: limit > 0 ? Math.max(0, limit - used) : null,
  };
}

/** Returns false if over quota */
export function consumeMessageQuota(username: string): boolean {
  const limit = config.dailyMessageQuota;
  if (limit <= 0) return true;
  const bucket = load();
  const used = bucket.counts[username] ?? 0;
  if (used >= limit) return false;
  bucket.counts[username] = used + 1;
  save(bucket);
  return true;
}
