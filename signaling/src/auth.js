"use strict";

const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// Spring Boot signs with Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret))
// which means it base64-decodes the config value before using it as the HMAC key.
// We must do the same so the signatures match.
const SECRET = Buffer.from(process.env.JWT_SECRET, "base64");

/**
 * Verify a Spring Boot-issued JWT and extract claims.
 * Returns { userId, role } on success, throws on failure.
 */
function verifyToken(token) {
  const payload = jwt.verify(token, SECRET, { algorithms: ["HS384"] });

  if (!payload.userId || !payload.role) {
    throw new Error("Token missing required claims");
  }

  // Only patients and providers may enter a consultation room
  if (!["PATIENT", "PROVIDER"].includes(payload.role)) {
    throw new Error(`Role '${payload.role}' is not allowed in consultation rooms`);
  }

  return { userId: payload.userId, role: payload.role };
}

module.exports = { verifyToken };
