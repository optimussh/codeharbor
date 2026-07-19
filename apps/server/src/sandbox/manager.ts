import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

export type SandboxStatus = {
  key: string;
  running: boolean;
  containerId?: string;
  containerName?: string;
  workspace?: string;
  error?: string;
  mode: "off" | "docker";
};

const running = new Map<string, SandboxStatus>();

function containerName(key: string): string {
  return `ch-sbx-${key.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 40)}`;
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["version", "--format", "{{.Server.Version}}"], {
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

export function getStatus(key: string): SandboxStatus {
  return (
    running.get(key) ?? {
      key,
      running: false,
      mode: "docker",
    }
  );
}

export async function startSandbox(opts: {
  key: string;
  workspace: string;
  network?: string;
}): Promise<SandboxStatus> {
  if (!config.sandboxEnabled) {
    return {
      key: opts.key,
      running: false,
      mode: "off",
      error: "SANDBOX_ENABLED=false",
    };
  }
  if (!(await dockerAvailable())) {
    return {
      key: opts.key,
      running: false,
      mode: "docker",
      error: "Docker daemon not available",
    };
  }

  const name = containerName(opts.key);
  // stop existing same name
  try {
    await execFileAsync("docker", ["rm", "-f", name], {
      timeout: 15000,
      windowsHide: true,
    });
  } catch {
    /* none */
  }

  const network =
    opts.network === "full"
      ? "bridge"
      : opts.network === "internal"
        ? "bridge"
        : "none";

  const args = [
    "run",
    "-d",
    "--name",
    name,
    `--memory=${config.sandboxMemory}`,
    `--cpus=${config.sandboxCpus}`,
    `--network=${network}`,
    "-v",
    `${opts.workspace}:/workspace`,
    "-w",
    "/workspace",
    config.sandboxImage,
    "sleep",
    "infinity",
  ];

  try {
    const { stdout } = await execFileAsync("docker", args, {
      timeout: 120000,
      windowsHide: true,
    });
    const id = stdout.trim();
    const st: SandboxStatus = {
      key: opts.key,
      running: true,
      containerId: id,
      containerName: name,
      workspace: opts.workspace,
      mode: "docker",
    };
    running.set(opts.key, st);
    return st;
  } catch (err) {
    return {
      key: opts.key,
      running: false,
      mode: "docker",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function stopSandbox(key: string): Promise<SandboxStatus> {
  const cur = running.get(key);
  const name = cur?.containerName ?? containerName(key);
  try {
    await execFileAsync("docker", ["rm", "-f", name], {
      timeout: 30000,
      windowsHide: true,
    });
  } catch {
    /* ignore */
  }
  const st: SandboxStatus = { key, running: false, mode: "docker" };
  running.set(key, st);
  return st;
}

/** unused helper keeps spawn import for future interactive shells */
export function _spawnPing(): void {
  spawn("docker", ["ps"], { windowsHide: true });
}
