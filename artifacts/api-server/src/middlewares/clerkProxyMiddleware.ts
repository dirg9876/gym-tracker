/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * IMPORTANT:
 * - Active in all environments (dev + production)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";

// For production Clerk instances the FAPI is clerk.<your-domain> → CNAME → frontend-api.clerk.services
// We connect to frontend-api.clerk.services but must set Host to the Clerk FAPI domain so
// Clerk knows which instance to serve (it's a multi-tenant service).
const CLERK_FAPI_IP = "https://frontend-api.clerk.services";

// Extract Clerk FAPI host from publishable key: pk_live_<base64(fapi_host + "$")>
function clerkFapiHost(): string {
  const key = process.env.CLERK_PUBLISHABLE_KEY || "";
  const b64 = key.replace(/^pk_(live|test)_/, "");
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    // decoded looks like "clerk.gym-beam.ru$"
    return decoded.replace(/\$$/, "");
  } catch {
    return "frontend-api.clerk.services";
  }
}

export const CLERK_PROXY_PATH = "/api/__clerk";

export function clerkProxyMiddleware(): RequestHandler {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  const fapiHost = clerkFapiHost();

  return createProxyMiddleware({
    target: CLERK_FAPI_IP,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        // Tell Clerk which instance to serve
        proxyReq.setHeader("Host", fapiHost);

        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host =
          (req.headers["x-forwarded-host"] as string) ||
          req.headers.host ||
          "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
    },
  }) as RequestHandler;
}
