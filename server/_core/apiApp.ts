import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const health = (_req: express.Request, res: express.Response) => res.json({ status: "ok" });
  app.get(["/api/health", "/health"], health);
  const platformConfig = (_req: express.Request, res: express.Response) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  };
  app.get(["/api/platform/config.js", "/platform/config.js"], platformConfig);
  registerOAuthRoutes(app);
  const trpcMiddleware = createExpressMiddleware({ router: appRouter, createContext });
  app.use(["/api/trpc", "/trpc"], trpcMiddleware);
  return app;
}
