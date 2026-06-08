"use strict";

/**
 * Integration tests for signaling handlers.
 * Uses in-process Socket.IO server + client.
 * Redis is mocked so no real connection is needed.
 */

// ── auth env (must be set before requiring auth.js / handlers.js) ─────────────
// auth.js base64-decodes JWT_SECRET and verifies with HS384.
const RAW_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.JWT_SECRET = Buffer.from(RAW_SECRET).toString("base64");

// ── Redis mock (same pattern as rooms.test.js) ────────────────────────────────
function createRedisMock() {
  const store = new Map();

  const get  = (k)        => { const e = store.get(k); return Promise.resolve(e?.type === "string" ? e.data : null); };
  const set  = (k, v)     => { store.set(k, { type: "string", data: v }); return Promise.resolve("OK"); };
  const del  = (...keys)  => { keys.flat().forEach(k => store.delete(k)); return Promise.resolve(1); };
  const expire = ()       => Promise.resolve(1);

  const hset = (k, f, v) => {
    if (!store.has(k)) store.set(k, { type: "hash", data: new Map() });
    store.get(k).data.set(f, v);
    return Promise.resolve(1);
  };
  const hget    = (k, f) => { const e = store.get(k); return Promise.resolve(e?.type === "hash" ? (e.data.get(f) ?? null) : null); };
  const hdel    = (k, f) => { const e = store.get(k); if (e?.type === "hash") e.data.delete(f); return Promise.resolve(1); };
  const hlen    = (k)    => { const e = store.get(k); return Promise.resolve(e?.type === "hash" ? e.data.size : 0); };
  const hgetall = (k)    => {
    const e = store.get(k);
    if (!e || e.type !== "hash" || e.data.size === 0) return Promise.resolve(null);
    const obj = {};
    for (const [kk, vv] of e.data) obj[kk] = vv;
    return Promise.resolve(obj);
  };
  const evalScript = (script, numkeys, ...rest) => {
    const keys = rest.slice(0, numkeys);
    const args = rest.slice(numkeys);
    const count = store.get(keys[0])?.data?.size ?? 0;
    if (count >= parseInt(args[0], 10)) return Promise.resolve(0);
    hset(keys[0], args[1], args[2]);
    return Promise.resolve(1);
  };

  const mock = { get, set, del, expire, hset, hget, hdel, hlen, hgetall, eval: evalScript, on: () => mock };
  return mock;
}

let mockRedis = createRedisMock();

jest.mock("../src/redis", () =>
  new Proxy({}, { get(_, prop) { return (...a) => mockRedis[prop]?.(...a); } })
);

// ── Imports (after mocks) ─────────────────────────────────────────────────────
const http        = require("http");
const { Server }  = require("socket.io");
const Client      = require("socket.io-client");
const jwt         = require("jsonwebtoken");
const { registerHandlers } = require("../src/handlers");

const SIGNING_SECRET = Buffer.from(process.env.JWT_SECRET, "base64");

function makeToken(userId, role) {
  return jwt.sign({ userId, role }, SIGNING_SECRET, { algorithm: "HS384" });
}

function createServer() {
  const srv = http.createServer();
  const io  = new Server(srv, { cors: { origin: "*" } });
  io.on("connection", (socket) => registerHandlers(io, socket));
  return new Promise((resolve) => {
    srv.listen(0, () => {
      const port = srv.address().port;
      resolve({ srv, io, port });
    });
  });
}

function connect(port) {
  return new Promise((resolve) => {
    const socket = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
  });
}

let srv, io, port;

beforeAll(async () => {
  ({ srv, io, port } = await createServer());
});

beforeEach(() => {
  // Fresh Redis store between tests so rooms don't bleed over
  mockRedis = createRedisMock();
});

afterAll(() => {
  io.close();
  srv.close();
});

// ── join (PROVIDER → "joined") ────────────────────────────────────────────────

describe("join event", () => {
  test("PROVIDER receives joined on successful join", (done) => {
    connect(port).then((socket) => {
      socket.emit("join", {
        roomId: "room-join-1",
        token:  makeToken("prov-1", "PROVIDER"),
      });
      socket.on("joined", (data) => {
        expect(data.roomId).toBe("room-join-1");
        expect(Array.isArray(data.peers)).toBe(true);
        socket.disconnect();
        done();
      });
    });
  });

  test("PATIENT receives in-lobby on join", (done) => {
    connect(port).then((socket) => {
      socket.emit("join", {
        roomId: "room-lobby-1",
        token:  makeToken("pat-1", "PATIENT"),
      });
      socket.on("in-lobby", (data) => {
        expect(data.roomId).toBe("room-lobby-1");
        socket.disconnect();
        done();
      });
    });
  });

  test("emits error when token is invalid", (done) => {
    connect(port).then((socket) => {
      socket.emit("join", { roomId: "room-err", token: "bad.token" });
      socket.on("error", (data) => {
        expect(data.message).toMatch(/Unauthorized/i);
        socket.disconnect();
        done();
      });
    });
  });

  test("emits error when roomId missing", (done) => {
    connect(port).then((socket) => {
      socket.emit("join", { token: makeToken("u1", "PROVIDER") });
      socket.on("error", (data) => {
        expect(data.message).toMatch(/required/i);
        socket.disconnect();
        done();
      });
    });
  });

  test("first PROVIDER receives peer-joined when second PROVIDER joins", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-peer-join";

      // s1 joins first; once confirmed, register peer-joined on s1 then s2 joins
      s1.emit("join", { roomId, token: makeToken("prov-a", "PROVIDER") });
      s1.on("joined", () => {
        s1.on("peer-joined", (data) => {
          expect(data.userId).toBe("prov-b");
          s1.disconnect(); s2.disconnect();
          done();
        });
        s2.emit("join", { roomId, token: makeToken("prov-b", "PROVIDER") });
      });
    });
  });
});

// ── leave event ───────────────────────────────────────────────────────────────

describe("leave event", () => {
  test("other peer receives peer-left on disconnect", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-leave-1";

      s1.emit("join", { roomId, token: makeToken("prov-ua", "PROVIDER") });
      s1.on("joined", () => {
        s2.emit("join", { roomId, token: makeToken("prov-ub", "PROVIDER") });
        s2.on("joined", () => {
          // Capture s2's id before disconnect clears it
          const s2Id = s2.id;
          s1.on("peer-left", (data) => {
            expect(data.socketId).toBe(s2Id);
            s1.disconnect();
            done();
          });
          s2.disconnect();
        });
      });
    });
  });
});

// ── offer / answer relay ──────────────────────────────────────────────────────

describe("offer / answer relay", () => {
  test("offer is forwarded to target peer", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-offer";

      s1.emit("join", { roomId, token: makeToken("prov-o1", "PROVIDER") });
      s1.on("joined", () => {
        s2.emit("join", { roomId, token: makeToken("prov-o2", "PROVIDER") });
        s2.on("joined", () => {
          s2.on("offer", (data) => {
            expect(data.sdp).toBe("sdp-offer-payload");
            expect(data.from).toBe(s1.id);
            s1.disconnect(); s2.disconnect();
            done();
          });
          s1.emit("offer", { to: s2.id, sdp: "sdp-offer-payload" });
        });
      });
    });
  });
});
