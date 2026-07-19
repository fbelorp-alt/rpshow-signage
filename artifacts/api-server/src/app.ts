import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

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
const ALLOWED_ORIGINS = [
  "https://app.rpshow.com.br",
  ...(process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean).map((d) => `https://${d.trim()}`),
];
app.use(cors({
  credentials: true,
  origin: (origin, cb) => {
    const allowLocalhost = process.env.NODE_ENV !== "production";
    if (!origin || ALLOWED_ORIGINS.some((o) => origin === o) || (allowLocalhost && /^http:\/\/localhost(:\d+)?$/.test(origin))) {
      cb(null, true);
    } else {
      cb(new Error("CORS not allowed"));
    }
  },
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// Global JSON error handler — must be last use() call
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Detect ZodError by shape (avoids importing zod directly in api-server)
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as any).issues)) {
    res.status(400).json({ error: "Dados inválidos", details: (err as any).issues });
    return;
  }
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : (err instanceof Error ? err.message : "Internal server error");
  logger.error({ err }, "Unhandled route error");
  res.status(500).json({ error: message });
});

export default app;
