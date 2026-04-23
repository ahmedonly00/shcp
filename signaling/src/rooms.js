"use strict";

/**
 * Redis-backed room registry with waiting-room (lobby) support.
 *
 * Redis key layout:
 *   room:{roomId}:active  HASH  socketId → JSON(peer)   — admitted peers
 *   room:{roomId}:lobby   HASH  socketId → JSON(peer)   — patients waiting to be admitted
 *   socket:{socketId}     STRING JSON({ roomId, inLobby }) — reverse lookup
 *
 * All keys carry a 24-hour TTL so orphaned rooms auto-expire.
 *
 * Waiting-room protocol:
 *   PATIENT joins → goes to lobby; provider receives 'patient-waiting'
 *   PROVIDER joins → goes to active room; gets list of waiting patients
 *   PROVIDER emits 'admit-patient' → patient moves from lobby to active room
 *   PROVIDER emits 'reject-patient' → patient removed from lobby
 */

const redis   = require("./redis");
const TTL_SEC = 86400; // 24 hours

const MAX_ACTIVE = 2; // 1 PROVIDER + 1 PATIENT

// ── Keys ──────────────────────────────────────────────────────────────────────

const activeKey  = (roomId) => `room:${roomId}:active`;
const lobbyKey   = (roomId) => `room:${roomId}:lobby`;
const socketKey  = (sid)    => `socket:${sid}`;

// ── join ──────────────────────────────────────────────────────────────────────

/**
 * Place a peer into a room.
 *  - PROVIDER → active room directly; also returns any waiting lobby patients
 *  - PATIENT  → lobby (waiting room); result has inLobby: true
 *
 * Returns:
 *   { ok: true, peers, waitingPatients, evictedSocketId } — provider joined
 *   { ok: true, inLobby: true, evictedSocketId }         — patient joined lobby
 *   { ok: false, reason }                                — room full
 */
async function join(roomId, socketId, userId, role) {
  const peerData = JSON.stringify({ userId, role, socketId });

  // ── Evict stale socket for the same userId (reconnect scenario) ─────────────
  let evictedSocketId = null;
  const [activeAll, lobbyAll] = await Promise.all([
    redis.hgetall(activeKey(roomId)),
    redis.hgetall(lobbyKey(roomId)),
  ]);

  const allEntries = { ...(activeAll || {}), ...(lobbyAll || {}) };
  for (const [sid, data] of Object.entries(allEntries)) {
    const peer = JSON.parse(data);
    if (peer.userId === userId) {
      evictedSocketId = sid;
      await Promise.all([
        redis.hdel(activeKey(roomId), sid),
        redis.hdel(lobbyKey(roomId), sid),
        redis.del(socketKey(sid)),
      ]);
      break;
    }
  }

  // ── Route by role ─────────────────────────────────────────────────────────
  if (role === "PROVIDER") {
    const currentActive = await redis.hlen(activeKey(roomId));
    if (currentActive >= MAX_ACTIVE) {
      return { ok: false, reason: "Room is full" };
    }

    await Promise.all([
      redis.hset(activeKey(roomId), socketId, peerData),
      redis.expire(activeKey(roomId), TTL_SEC),
      redis.set(socketKey(socketId),
        JSON.stringify({ roomId, inLobby: false }), "EX", TTL_SEC),
    ]);

    // Return current active peers (excluding self) and any waiting patients
    const updatedActive = await redis.hgetall(activeKey(roomId));
    const peers = Object.entries(updatedActive || {})
      .filter(([sid]) => sid !== socketId)
      .map(([, d]) => JSON.parse(d));

    const updatedLobby = await redis.hgetall(lobbyKey(roomId));
    const waitingPatients = Object.values(updatedLobby || {}).map(d => JSON.parse(d));

    return { ok: true, peers, waitingPatients, evictedSocketId };

  } else {
    // PATIENT → lobby
    await Promise.all([
      redis.hset(lobbyKey(roomId), socketId, peerData),
      redis.expire(lobbyKey(roomId), TTL_SEC),
      redis.set(socketKey(socketId),
        JSON.stringify({ roomId, inLobby: true }), "EX", TTL_SEC),
    ]);

    return { ok: true, inLobby: true, evictedSocketId };
  }
}

// ── admitPatient ──────────────────────────────────────────────────────────────

/**
 * Move a patient from lobby into the active room.
 * Returns: { ok: true, peer, peers } or { ok: false, reason }
 */
async function admitPatient(roomId, patientSocketId) {
  const peerData = await redis.hget(lobbyKey(roomId), patientSocketId);
  if (!peerData) {
    return { ok: false, reason: "Patient not found in lobby" };
  }

  const activeCount = await redis.hlen(activeKey(roomId));
  if (activeCount >= MAX_ACTIVE) {
    return { ok: false, reason: "Room is full" };
  }

  await Promise.all([
    redis.hdel(lobbyKey(roomId), patientSocketId),
    redis.hset(activeKey(roomId), patientSocketId, peerData),
    redis.expire(activeKey(roomId), TTL_SEC),
    redis.set(socketKey(patientSocketId),
      JSON.stringify({ roomId, inLobby: false }), "EX", TTL_SEC),
  ]);

  // Active peers other than the newly admitted patient
  const updatedActive = await redis.hgetall(activeKey(roomId));
  const peers = Object.entries(updatedActive || {})
    .filter(([sid]) => sid !== patientSocketId)
    .map(([, d]) => JSON.parse(d));

  return { ok: true, peer: JSON.parse(peerData), peers };
}

// ── rejectPatient ─────────────────────────────────────────────────────────────

async function rejectPatient(roomId, patientSocketId) {
  await Promise.all([
    redis.hdel(lobbyKey(roomId), patientSocketId),
    redis.del(socketKey(patientSocketId)),
  ]);
}

// ── leave ─────────────────────────────────────────────────────────────────────

/**
 * Remove a peer from whichever room/lobby they are in.
 * Returns: { roomId, inLobby } or null if not found.
 */
async function leave(socketId) {
  const raw = await redis.get(socketKey(socketId));
  if (!raw) return null;

  const { roomId, inLobby } = JSON.parse(raw);
  const key = inLobby ? lobbyKey(roomId) : activeKey(roomId);

  await Promise.all([
    redis.hdel(key, socketId),
    redis.del(socketKey(socketId)),
  ]);

  // Clean up empty room keys
  const [aCount, lCount] = await Promise.all([
    redis.hlen(activeKey(roomId)),
    redis.hlen(lobbyKey(roomId)),
  ]);
  if (aCount === 0) redis.del(activeKey(roomId));
  if (lCount === 0) redis.del(lobbyKey(roomId));

  return { roomId, inLobby };
}

// ── Lookups ───────────────────────────────────────────────────────────────────

async function getSocketInfo(socketId) {
  const raw = await redis.get(socketKey(socketId));
  return raw ? JSON.parse(raw) : null;
}

async function getRoomId(socketId) {
  const info = await getSocketInfo(socketId);
  return info?.roomId ?? null;
}

module.exports = {
  join,
  leave,
  admitPatient,
  rejectPatient,
  getSocketInfo,
  getRoomId,
};
