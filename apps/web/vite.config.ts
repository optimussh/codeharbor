import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gateway =
    env.VITE_GATEWAY_URL?.replace(/\/$/, "") || "http://127.0.0.1:5300";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Prefer 127.0.0.1 so cookie host matches platform (avoid localhost vs 127.0.0.1 split)
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: gateway,
          changeOrigin: true,
        },
      },
    },
  };
});
