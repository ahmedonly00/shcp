"use strict";

// auth.js base64-decodes JWT_SECRET before using it as the HMAC key,
// and verifies with HS384.  Tests must match both conventions.
const RAW_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.JWT_SECRET = Buffer.from(RAW_SECRET).toString("base64");

const jwt = require("jsonwebtoken");
const { verifyToken } = require("../src/auth");

// Sign with the raw (pre-encoded) secret so the decoded value matches
const SIGNING_SECRET = Buffer.from(process.env.JWT_SECRET, "base64");

function sign(payload, opts = {}) {
  return jwt.sign(payload, SIGNING_SECRET, { algorithm: "HS384", expiresIn: "1h", ...opts });
}

describe("verifyToken", () => {
  test("returns userId and role for valid PATIENT token", () => {
    const token = sign({ userId: "user-1", role: "PATIENT" });
    const result = verifyToken(token);
    expect(result.userId).toBe("user-1");
    expect(result.role).toBe("PATIENT");
  });

  test("returns userId and role for valid PROVIDER token", () => {
    const token = sign({ userId: "prov-1", role: "PROVIDER" });
    const result = verifyToken(token);
    expect(result.userId).toBe("prov-1");
    expect(result.role).toBe("PROVIDER");
  });

  test("throws for ADMIN role (not allowed in rooms)", () => {
    const token = sign({ userId: "admin-1", role: "ADMIN" });
    expect(() => verifyToken(token)).toThrow(/not allowed/i);
  });

  test("throws for expired token", () => {
    const token = sign({ userId: "u1", role: "PATIENT" }, { expiresIn: "-1s" });
    expect(() => verifyToken(token)).toThrow();
  });

  test("throws for token signed with wrong secret", () => {
    const token = jwt.sign(
      { userId: "u1", role: "PATIENT" },
      "wrong-secret",
      { algorithm: "HS256" }
    );
    expect(() => verifyToken(token)).toThrow();
  });

  test("throws when userId claim is missing", () => {
    const token = sign({ role: "PATIENT" });
    expect(() => verifyToken(token)).toThrow(/required claims/i);
  });

  test("throws when role claim is missing", () => {
    const token = sign({ userId: "u1" });
    expect(() => verifyToken(token)).toThrow(/required claims/i);
  });

  test("throws for malformed token string", () => {
    expect(() => verifyToken("not.a.token")).toThrow();
  });

  test("throws for empty string", () => {
    expect(() => verifyToken("")).toThrow();
  });
});
