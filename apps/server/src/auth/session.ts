import session from "express-session";
import { config } from "../config.js";

export function createSessionMiddleware() {
  return session({
    name: "vibe.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}
