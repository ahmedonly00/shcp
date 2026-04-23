"use strict";

/**
 * Integration tests for signaling handlers.
 * Uses in-process Socket.IO server + client.
 */

process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";

const http        = require("http");
const { Server }  = require("socket.io");
const Client      = require("socket.io-client");
const jwt         = require("jsonwebtoken");
const { registerHandlers } = require("../src/handlers");

const SECRET = process.env.JWT_SECRET;

function makeToken(userId, role) {
  return jwt.sign({ userId, role }, SECRET, { algorithm: "HS256" });
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
    const socket = Client(`http://localhost:${port}`, {
      transports: ["websocket"],
    });
    socket.on("connect", () => resolve(socket));
  });
}

let srv, io, port;

beforeAll(async () => {
  ({ srv, io, port } = await createServer());
});

afterAll(() => {
  io.close();
  srv.close();
});

describe("join event", () => {
  test("emits joined on successful join", (done) => {
    connect(port).then((socket) => {
      socket.emit("join", {
        roomId: "room-join-1",
        token:  makeToken("user-p", "PATIENT"),
      });
      socket.on("joined", (data) => {
        expect(data.roomId).toBe("room-join-1");
        expect(Array.isArray(data.peers)).toBe(true);
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
      socket.emit("join", { token: makeToken("u1", "PATIENT") });
      socket.on("error", (data) => {
        expect(data.message).toMatch(/required/i);
        socket.disconnect();
        done();
      });
    });
  });

  test("second peer receives peer-joined event", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-peer-join";

      s1.emit("join", { roomId, token: makeToken("user-a", "PATIENT") });
      s1.on("joined", () => {
        s2.on("peer-joined", (data) => {
          expect(data.userId).toBe("user-a");
          s1.disconnect(); s2.disconnect();
          done();
        });
        s2.emit("join", { roomId, token: makeToken("user-b", "PROVIDER") });
      });
    });
  });
});

describe("leave event", () => {
  test("other peer receives peer-left on disconnect", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-leave-1";

      s1.emit("join", { roomId, token: makeToken("ua", "PATIENT") });
      s1.on("joined", () => {
        s2.emit("join", { roomId, token: makeToken("ub", "PROVIDER") });
        s2.on("joined", () => {
          s1.on("peer-left", (data) => {
            expect(data.socketId).toBe(s2.id);
            s1.disconnect();
            done();
          });
          s2.disconnect();
        });
      });
    });
  });
});

describe("offer / answer relay", () => {
  test("offer is forwarded to target peer", (done) => {
    Promise.all([connect(port), connect(port)]).then(([s1, s2]) => {
      const roomId = "room-offer";

      s1.emit("join", { roomId, token: makeToken("o1", "PATIENT") });
      s1.on("joined", () => {
        s2.emit("join", { roomId, token: makeToken("o2", "PROVIDER") });
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
