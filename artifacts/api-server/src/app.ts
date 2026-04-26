import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Restrict CORS to the configured frontend origin.
// REPLIT_DEV_DOMAIN is injected by the Replit runtime; ALLOWED_ORIGIN can
// override it in production deployment settings.
const allowedOrigin =
  process.env.ALLOWED_ORIGIN ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const corsOrigin = allowedOrigin
  ? allowedOrigin
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : false;

app.use(cors({ credentials: true, origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use(
  "/api",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  router,
);

export default app;
