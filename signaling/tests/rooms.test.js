"use strict";

/**
 * Unit tests for src/rooms.js.
 *
 * Redis is mocked so no real connection is needed.
 * The in-memory store is reset between tests via jest.resetModules().
 */

// ── Mock ioredis before any require of src/redis.js ──────────────────────────

// Simple in-memory Redis mock (hashes + strings + del/expire/eval)
function createRedisMock() {
  const store = new Map(); // key → { type, data }

  function get(key) { const e = store.get(key); return Promise.resolve(e?.type === "string" ? e.data : null); }
  function set(key, val, ...args) { store.set(key, { type: "string", data: val }); return Promise.resolve("OK"); }
  function del(...keys) { keys.flat().forEach(k => store.delete(k)); return Promise.resolve(1); }
  function expire(key, ttl) { return Promise.resolve(1); }

  function hset(key, field, val) {
    if (!store.has(key)) store.set(key, { type: "hash", data: new Map() });
    store.get(key).data.set(field, val);
    return Promise.resolve(1);
  }
  function hget(key, field) {
    const e = store.get(key);
    return Promise.resolve(e?.type === "hash" ? (e.data.get(field) ?? null) : null);
  }
  function hdel(key, field) {
    const e = store.get(key);
    if (e?.type === "hash") e.data.delete(field);
    return Promise.resolve(1);
  }
  function hlen(key) {
    const e = store.get(key);
    return Promise.resolve(e?.type === "hash" ? e.data.size : 0);
  }
  function hgetall(key) {
    const e = store.get(key);
    if (!e || e.type !== "hash" || e.data.size === 0) return Promise.resolve(null);
    const obj = {};
    for (const [k, v] of e.data) obj[k] = v;
    return Promise.resolve(obj);
  }

  // Minimal eval for the ADMIT_SCRIPT: checks HLEN(KEYS[1]) < ARGV[1]; if so, HSET
  function evalScript(script, numkeys, ...rest) {
    const keys = rest.slice(0, numkeys);
    const args = rest.slice(numkeys);
    const count = store.get(keys[0])?.data?.size ?? 0;
    if (count >= parseInt(args[0], 10)) return Promise.resolve(0);
    hset(keys[0], args[1], args[2]);
    return Promise.resolve(1);
  }

  const mock = {
    get, set, del, expire,
    hset, hget, hdel, hlen, hgetall,
    eval: evalScript,
    on: () => mock,           // silence event-listener calls in redis.js
    disconnect: () => {},
  };
  return mock;
}

let mockRedis;

jest.mock("../src/redis", () => {
  // Return the mock created in beforeEach (accessed via closure)
  return new Proxy({}, {
    get(_, prop) { return (...a) => mockRedis[prop]?.(...a); },
  });
});

// Re-require rooms after resetting modules so the mock store is fresh
function freshRooms() {
  return require("../src/rooms");
}

beforeEach(() => {
  mockRedis = createRedisMock();
  jest.resetModules();
});

// ── rooms.join ────────────────────────────────────────────────────────────────

describe("rooms.join", () => {
  test("first peer (PROVIDER) joins successfully", async () => {
    const r = freshRooms();
    const result = await r.join("room1", "s1", "user1", "PROVIDER");
    expect(result.ok).toBe(true);
    expect(result.peers).toHaveLength(0);
  });

  test("second peer (PATIENT) joins lobby", async () => {
    const r = freshRooms();
    await r.join("room1", "s1", "user1", "PROVIDER");
    const result = await r.join("room1", "s2", "user2", "PATIENT");
    expect(result.ok).toBe(true);
    expect(result.inLobby).toBe(true);
  });

  test("second PROVIDER is rejected when room is full", async () => {
    const r = freshRooms();
    await r.join("room1", "s1", "user1", "PROVIDER");
    await r.join("room1", "s2", "user2", "PROVIDER");
    const result = await r.join("room1", "s3", "user3", "PROVIDER");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/full/i);
  });

  test("reconnecting peer evicts stale socket", async () => {
    const r = freshRooms();
    await r.join("room1", "s1", "user1", "PROVIDER");
    // Same userId reconnects with a new socket id
    const result = await r.join("room1", "s1b", "user1", "PROVIDER");
    expect(result.ok).toBe(true);
    expect(result.evictedSocketId).toBe("s1");
  });
});

// ── rooms.leave ───────────────────────────────────────────────────────────────

describe("rooms.leave", () => {
  test("returns roomId when PROVIDER leaves", async () => {
    const r = freshRooms();
    await r.join("room1", "s1", "user1", "PROVIDER");
    const info = await r.leave("s1");
    expect(info.roomId).toBe("room1");
    expect(info.inLobby).toBe(false);
  });

  test("returns roomId + inLobby:true when PATIENT leaves lobby", async () => {
    const r = freshRooms();
    await r.join("room1", "s1", "user1", "PATIENT");
    const info = await r.leave("s1");
    expect(info.roomId).toBe("room1");
    expect(info.inLobby).toBe(true);
  });

  test("returns null for unknown socket", async () => {
    const r = freshRooms();
    const result = await r.leave("unknown");
    expect(result).toBeNull();
  });
});

// ── rooms.getRoomId ───────────────────────────────────────────────────────────

describe("rooms.getRoomId", () => {
  test("returns correct room for socket", async () => {
    const r = freshRooms();
    await r.join("roomX", "sx", "userX", "PROVIDER");
    const roomId = await r.getRoomId("sx");
    expect(roomId).toBe("roomX");
  });

  test("returns null for socket not in any room", async () => {
    const r = freshRooms();
    const roomId = await r.getRoomId("nobody");
    expect(roomId).toBeNull();
  });
});

// ── rooms.admitPatient ────────────────────────────────────────────────────────

describe("rooms.admitPatient", () => {
  test("moves patient from lobby to active room", async () => {
    const r = freshRooms();
    await r.join("room1", "sp", "provider1", "PROVIDER");
    await r.join("room1", "sq", "patient1",  "PATIENT");
    const result = await r.admitPatient("room1", "sq");
    expect(result.ok).toBe(true);
    expect(result.peer.userId).toBe("patient1");
  });

  test("returns error for unknown patient socket", async () => {
    const r = freshRooms();
    const result = await r.admitPatient("room1", "no-such-socket");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });
});
