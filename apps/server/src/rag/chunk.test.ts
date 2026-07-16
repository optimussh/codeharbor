import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk.js";
import { localEmbed } from "./embed.js";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  it("splits long text with overlap", () => {
    const text = "a".repeat(3000);
    const chunks = chunkText(text, 1000, 100);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]!.length).toBeLessThanOrEqual(1000);
  });
});

describe("localEmbed", () => {
  it("returns fixed dims and unit-ish length", () => {
    const v = localEmbed("hello rag world", 768);
    expect(v).toHaveLength(768);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is somewhat similar for related text", () => {
    const a = localEmbed("postgres vector database search");
    const b = localEmbed("vector search with postgres database");
    const c = localEmbed("banana smoothie recipe");
    const sim = (x: number[], y: number[]) =>
      x.reduce((s, v, i) => s + v * y[i]!, 0);
    expect(sim(a, b)).toBeGreaterThan(sim(a, c));
  });
});
