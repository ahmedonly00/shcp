"use strict";

const rooms = require("../src/rooms");

// Reset module state between tests
beforeEach(() => {
  // leave all sockets by accessing the private map through the module
  // Simplest approach: re-require with jest module reset
  jest.resetModules();
});

// Re-require after reset in each test
function freshRooms() {
  return require("../src/rooms");
}

describe("rooms.join", () => {
  test("first peer joins successfully", () => {
    const r = freshRooms();
    const result = r.join("room1", "s1", "user1", "PATIENT");
    expect(result.ok).toBe(true);
    expect(result.peers).toHaveLength(0);
  });

  test("second peer joins and sees first peer", () => {
    const r = freshRooms();
    r.join("room1", "s1", "user1", "PATIENT");
    const result = r.join("room1", "s2", "user2", "PROVIDER");
    expect(result.ok).toBe(true);
    expect(result.peers).toHaveLength(1);
    expect(result.peers[0].userId).toBe("user1");
  });

  test("third peer is rejected (room full)", () => {
    const r = freshRooms();
    r.join("room1", "s1", "user1", "PATIENT");
    r.join("room1", "s2", "user2", "PROVIDER");
    const result = r.join("room1", "s3", "user3", "PATIENT");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/full/i);
  });

  test("same userId rejected as duplicate", () => {
    const r = freshRooms();
    r.join("room1", "s1", "user1", "PATIENT");
    const result = r.join("room1", "s2", "user1", "PATIENT");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already joined/i);
  });
});

describe("rooms.leave", () => {
  test("returns roomId when peer leaves", () => {
    const r = freshRooms();
    r.join("room1", "s1", "user1", "PATIENT");
    const roomId = r.leave("s1");
    expect(roomId).toBe("room1");
  });

  test("room is deleted when last peer leaves", () => {
    const r = freshRooms();
    r.join("room1", "s1", "user1", "PATIENT");
    r.leave("s1");
    expect(r.size("room1")).toBe(0);
  });

  test("returns null for unknown socket", () => {
    const r = freshRooms();
    expect(r.leave("unknown")).toBeNull();
  });
});

describe("rooms.getRoomId", () => {
  test("returns correct room for socket", () => {
    const r = freshRooms();
    r.join("roomX", "sx", "userX", "PATIENT");
    expect(r.getRoomId("sx")).toBe("roomX");
  });

  test("returns null for socket not in any room", () => {
    const r = freshRooms();
    expect(r.getRoomId("nobody")).toBeNull();
  });
});
