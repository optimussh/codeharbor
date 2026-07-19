/** CodeHarbor BFF origin (admin, chamber open from :5173). */
export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:5300";
