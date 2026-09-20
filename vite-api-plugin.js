import { pathToFileURL } from "url";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Vite plugin that serves /api/* routes as serverless-style handlers
 * in the dev server, mirroring how they run on Vercel in production.
 *
 * Files like /api/paymongo/payout.js export `default async function handler(req, res)`.
 * This middleware parses JSON bodies for POST/PUT/PATCH, then delegates.
 */
export function apiMiddleware() {
  return {
    name: "api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname;

        if (!path.startsWith("/api/")) return next();

        // /api/paymongo/payout → ./api/paymongo/payout.js
        const filePath = join(process.cwd(), path + ".js");
        if (!existsSync(filePath)) return next();

        try {
          // Cache-bust so edits to API files are picked up
          const mod = await import(pathToFileURL(filePath).href + "?t=" + Date.now());
          if (!mod.default || typeof mod.default !== "function") return next();

          // Parse JSON body for methods that have one
          if (["POST", "PUT", "PATCH"].includes(req.method)) {
            await new Promise((resolve) => {
              let body = "";
              req.on("data", (chunk) => { body += chunk; });
              req.on("end", () => {
                try { req.body = JSON.parse(body); } catch { req.body = {}; }
                resolve();
              });
              req.on("error", () => { req.body = {}; resolve(); });
            });
          }

          await mod.default(req, res);
        } catch (e) {
          console.error("[api-middleware] error:", e);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message || "API route error" }));
          }
        }
      });
    },
  };
}
