import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import * as sessionMap from "../sessionMap.js";
import { checkOpencodeHealth } from "../opencode/client.js";
import { ensureWorkspace } from "../workspace.js";
import { opencodeUrl } from "../opencode/http.js";

export const eventsRouter = Router();

eventsRouter.get("/events", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const workspace = ensureWorkspace(config.workspacesRoot, username);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: "server.connected", properties: { username, workspace } });

  if ((await checkOpencodeHealth()) !== "up") {
    send({
      type: "opencode.down",
      properties: { message: "OpenCode is not running on :4096" },
    });
  }

  const controller = new AbortController();

  const pump = async () => {
    try {
      const urls = [
        opencodeUrl("/event", workspace),
        `${config.opencodeBaseUrl}/event`,
      ];
      let upstream: Response | null = null;
      for (const url of urls) {
        try {
          const r = await fetch(url, {
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (r.ok && r.body) {
            upstream = r;
            break;
          }
        } catch {
          // try next
        }
      }
      if (!upstream?.body) {
        send({
          type: "opencode.down",
          properties: { message: "SSE upstream failed" },
        });
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const raw = dataLine.replace(/^data:\s?/, "");
          try {
            const evt = JSON.parse(raw) as {
              type?: string;
              properties?: Record<string, unknown>;
            };
            const props = evt.properties ?? {};
            const sid =
              (props.sessionID as string | undefined) ??
              (props.sessionId as string | undefined) ??
              ((props.info as { sessionID?: string } | undefined)?.sessionID);

            if (sid && !sessionMap.assertOwner(sid, username)) {
              continue;
            }
            send(evt);
          } catch {
            send({ type: "raw", properties: { raw } });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        send({
          type: "sse.error",
          properties: { message: (err as Error).message },
        });
      }
    }
  };

  void pump();

  const hb = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(hb);
    controller.abort();
  });
});
