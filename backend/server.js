import "dotenv/config";
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import { getWebSocketUrl } from "./src/utils/url.js";
import websocketRoutes from "./src/routes/websocket.js";
import twimlRoutes from "./src/routes/twiml.js";
import httpProxy from "@fastify/http-proxy";

const PORT = process.env.PORT || 8080;

const fastify = Fastify();

// Register WebSocket support first
fastify.register(fastifyWs);

// Register API routes (these take priority)
fastify.register(twimlRoutes);
fastify.register(websocketRoutes);

// Proxy frontend requests to Next.js dev server
// Only proxy requests to /app path
fastify.register(httpProxy, {
  upstream: "http://localhost:3000",
  prefix: "/app",
  rewritePrefix: "/",
});

try {
  fastify.listen({ port: PORT });
  console.log(`🚀 Server running at:
  - Backend API: http://localhost:${PORT}
  - Frontend App: ${process.env.HOST}/app
  - WebSocket: ${getWebSocketUrl(process.env.HOST)}
  - Voice Webhook: ${process.env.HOST}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
