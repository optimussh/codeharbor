import { spawn, type ChildProcess } from "node:child_process";
import { config } from "../config.js";
import { checkOpencodeHealth, configureGeminiIfNeeded } from "./client.js";

let child: ChildProcess | null = null;

export async function ensureOpencodeRunning(): Promise<void> {
  if ((await checkOpencodeHealth()) === "up") {
    await configureGeminiIfNeeded();
    return;
  }

  if (!config.opencodeManaged) {
    console.warn(
      "[opencode] not running and OPENCODE_MANAGED=false — start manually: opencode serve --port 4096",
    );
    return;
  }

  console.log(`[opencode] starting: ${config.opencodeBin} serve ...`);
  try {
    child = spawn(
      config.opencodeBin,
      ["serve", "--port", "4096", "--hostname", "127.0.0.1"],
      {
        env: {
          ...process.env,
          GEMINI_API_KEY: config.geminiApiKey,
          GOOGLE_GENERATIVE_AI_API_KEY: config.geminiApiKey,
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        windowsHide: true,
      },
    );

    child.stdout?.on("data", (d: Buffer) => {
      process.stdout.write(`[opencode] ${d.toString()}`);
    });
    child.stderr?.on("data", (d: Buffer) => {
      process.stderr.write(`[opencode] ${d.toString()}`);
    });
    child.on("exit", (code) => {
      console.warn(`[opencode] process exited code=${code}`);
      child = null;
    });
    child.on("error", (err) => {
      console.error(
        "[opencode] failed to start. Install: npm i -g opencode-ai",
        err.message,
      );
      child = null;
    });

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if ((await checkOpencodeHealth()) === "up") {
        console.log("[opencode] is up");
        await configureGeminiIfNeeded();
        return;
      }
    }
    console.warn("[opencode] still down after spawn wait");
  } catch (err) {
    console.error("[opencode] spawn error:", err);
  }
}

export function stopOpencode(): void {
  if (child && !child.killed) {
    child.kill();
    child = null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
