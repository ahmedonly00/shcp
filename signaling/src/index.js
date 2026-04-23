"use strict";

require("dotenv").config();

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const logger     = require("./logger");
const { registerHandlers } = require("./handlers");

const PORT          = parseInt(process.env.PORT || "3001", 10);
const FRONTEND_URL  = process.env.FRONTEND_URL || "http://localhost:3000";
const API_ORIGIN    = process.env.API_ORIGIN    || "http://localhost:8080";

// ── HTTP app ──────────────────────────────────────────────────────────────────
const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, API_ORIGIN],
    methods: ["GET", "POST"],
  },
  // Limit message size to prevent abuse
  maxHttpBufferSize: 64 * 1024,   // 64 KB
});

io.on("connection", (socket) => {
  logger.debug("socket connected id=%s", socket.id);
  registerHandlers(io, socket);
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info("SHCP signaling server listening on port %d", PORT);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — closing server");
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };   // exported for tests
