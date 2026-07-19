import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { ensureOidcUser } from "../users.js";
import { appendAudit } from "../audit.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import type { Role } from "../types.js";

export const oidcRouter = Router();

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
};

let discoveryCache: OidcDiscovery | null = null;

async function discovery(): Promise<OidcDiscovery> {
  if (discoveryCache) return discoveryCache;
  const url = config.oidc.issuer.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  discoveryCache = (await res.json()) as OidcDiscovery;
  return discoveryCache;
}

oidcRouter.get("/oidc/login", async (req, res) => {
  if (!config.oidc.enabled) {
    res.status(503).json({ error: "OIDC disabled" });
    return;
  }
  try {
    const d = await discovery();
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    (req.session as { oidcState?: string; oidcNonce?: string; oidcNext?: string }).oidcState =
      state;
    (req.session as { oidcNonce?: string }).oidcNonce = nonce;
    (req.session as { oidcNext?: string }).oidcNext = String(
      req.query.next ?? "/",
    );
    const u = new URL(d.authorization_endpoint);
    u.searchParams.set("client_id", config.oidc.clientId);
    u.searchParams.set("redirect_uri", config.oidc.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "openid profile email");
    u.searchParams.set("state", state);
    u.searchParams.set("nonce", nonce);
    res.redirect(u.toString());
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : "OIDC login failed",
    });
  }
});

oidcRouter.get("/oidc/callback", async (req, res) => {
  if (!config.oidc.enabled) {
    res.status(503).send("OIDC disabled");
    return;
  }
  const sess = req.session as {
    oidcState?: string;
    oidcNonce?: string;
    oidcNext?: string;
    user?: { username: string; role: Role };
  };
  const state = String(req.query.state ?? "");
  const code = String(req.query.code ?? "");
  if (!code || !state || state !== sess.oidcState) {
    res.status(400).send("Invalid OIDC state");
    return;
  }
  try {
    const d = await discovery();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.oidc.redirectUri,
      client_id: config.oidc.clientId,
      client_secret: config.oidc.clientSecret,
    });
    const tokenRes = await fetch(d.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenRes.ok) {
      res.status(502).send(`Token exchange failed: ${tokenRes.status}`);
      return;
    }
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
    };

    let email = "";
    let sub = "";
    let preferred = "";
    const groups: string[] = [];

    if (tokens.id_token) {
      const payload = tokens.id_token.split(".")[1];
      if (payload) {
        const json = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ) as Record<string, unknown>;
        sub = String(json.sub ?? "");
        email = String(json.email ?? "");
        preferred = String(
          json.preferred_username ?? json.email ?? json.sub ?? "oidc-user",
        );
        const g = json[config.oidc.groupsClaim];
        if (Array.isArray(g)) groups.push(...g.map(String));
      }
    }

    if (d.userinfo_endpoint && tokens.access_token) {
      try {
        const ui = await fetch(d.userinfo_endpoint, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (ui.ok) {
          const j = (await ui.json()) as Record<string, unknown>;
          sub = String(j.sub ?? sub);
          email = String(j.email ?? email);
          preferred = String(
            j.preferred_username ?? j.email ?? preferred ?? sub,
          );
          const g = j[config.oidc.groupsClaim];
          if (Array.isArray(g)) groups.push(...g.map(String));
        }
      } catch {
        /* id_token enough */
      }
    }

    const username = (preferred || email || sub || "oidc-user")
      .split("@")[0]!
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 64) || "oidc-user";

    let role: Role = "user";
    if (
      config.oidc.adminGroup &&
      groups.some((g) => g === config.oidc.adminGroup)
    ) {
      role = "admin";
    }

    const user = ensureOidcUser(username, role, email);
    if (user.disabled) {
      res.status(403).send("User disabled");
      return;
    }

    bootstrapUserWorkspace(user.username);
    sess.user = { username: user.username, role: user.role };
    delete sess.oidcState;
    delete sess.oidcNonce;
    appendAudit("login", user.username, { method: "oidc", sub, email });

    const next = sess.oidcNext?.startsWith("/") ? sess.oidcNext : "/";
    res.redirect(next);
  } catch (e) {
    res
      .status(502)
      .send(e instanceof Error ? e.message : "OIDC callback failed");
  }
});
