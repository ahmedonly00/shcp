"use strict";

const Redis  = require("ioredis");
const logger = require("./logger");

const client = new Redis({
  host:     process.env.REDIS_HOST     || "localhost",
  port:     parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // Exponential back-off: 50 ms, 100 ms, … capped at 2 s
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

client.on("connect",     () => logger.info("Redis connected"));
client.on("ready",       () => logger.info("Redis ready"));
client.on("error",  (err) => logger.error("Redis error: %s", err.message));
client.on("reconnecting",() => logger.warn("Redis reconnecting…"));

module.exports = client;
