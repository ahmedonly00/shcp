"use strict";

/**
 * Socket.IO event handlers for WebRTC signaling.
 *
 * Protocol (client → server):
 *   join            { roomId, token }
 *   admit-patient   { socketId }                — PROVIDER only
 *   reject-patient  { socketId }                — PROVIDER only
 *   offer           { to, sdp }
 *   answer          { to, sdp }
 *   ice-candidate   { to, candidate }
 *   chat-message    { message }
 *   leave           (no payload)
 *
 * Protocol (server → client):
 *   joined          { roomId, peers }           — PROVIDER: entered active room
 *   in-lobby        { roomId }                  — PATIENT: waiting to be admitted
 *   patient-waiting { userId, socketId }        — PROVIDER: patient entered lobby
 *   admitted        { roomId, peers }           — PATIENT: provider admitted them
 *   rejected        { message }                 — PATIENT: provider rejected them
 *   patient-left-lobby { socketId }             — PROVIDER: patient left lobby
 *   peer-joined     { userId, role, socketId }
 *   peer-left       { socketId }
 *   offer           { from, sdp }
 *   answer          { from, sdp }
 *   ice-candidate   { from, candidate }
 *   chat-message    { from, message }
 *   error           { message }
 */

const rooms = require("./rooms");
const { verifyToken } = require("./auth");
const logger = require("./logger");

function registerHandlers(io, socket) {

  // ── join ────────────────────────────────────────────────────────────────────
  socket.on("join", async ({ roomId, token } = {}) => {
    if (!roomId || !token) {
      socket.emit("error", { message: "roomId and token are required" });
      return;
    }

    let userId, role;
    try {
      ({ userId, role } = verifyToken(token));
    } catch (err) {
      socket.emit("error", { message: "Unauthorized: " + err.message });
      return;
    }

    let result;
    try {
      result = await rooms.join(roomId, socket.id, userId, role);
    } catch (err) {
      logger.error("rooms.join error roomId=%s: %s", roomId, err.message);
      socket.emit("error", { message: "Internal error joining room" });
      return;
    }

    if (!result.ok) {
      socket.emit("error", { message: result.reason });
      return;
    }

    // Always join the Socket.IO room for message routing
    socket.join(roomId);

    // Notify peer of stale socket eviction so it can update its remotePeerSocketId
    if (result.evictedSocketId) {
      socket.to(roomId).emit("peer-left", { socketId: result.evictedSocketId });
      logger.info("evict stale sid=%s on rejoin roomId=%s userId=%s",
        result.evictedSocketId, roomId, userId);
    }

    if (result.inLobby) {
      // ── PATIENT entered lobby ──────────────────────────────────────────────
      socket.emit("in-lobby", { roomId });

      // Tell provider (if already in the room) about the waiting patient
      socket.to(roomId).emit("patient-waiting", { userId, socketId: socket.id });

      logger.info("join-lobby roomId=%s userId=%s sid=%s", roomId, userId, socket.id);

    } else {
      // ── PROVIDER entered active room ───────────────────────────────────────
      socket.emit("joined", { roomId, peers: result.peers });

      // Notify existing active peers
      socket.to(roomId).emit("peer-joined", { userId, role, socketId: socket.id });

      // Notify provider about any patients already waiting in the lobby
      if (result.waitingPatients && result.waitingPatients.length > 0) {
        result.waitingPatients.forEach(p => {
          socket.emit("patient-waiting", { userId: p.userId, socketId: p.socketId });
        });
      }

      logger.info("join roomId=%s userId=%s role=%s sid=%s peers=%d waiting=%d",
        roomId, userId, role, socket.id,
        result.peers.length, (result.waitingPatients || []).length);
    }
  });

  // ── admit-patient ────────────────────────────────────────────────────────────
  socket.on("admit-patient", async ({ socketId: patientSocketId } = {}) => {
    if (!patientSocketId) return;

    let info;
    try {
      info = await rooms.getSocketInfo(socket.id);
    } catch (err) {
      logger.error("getSocketInfo error: %s", err.message);
      return;
    }

    if (!info) { socket.emit("error", { message: "You are not in a room" }); return; }

    let result;
    try {
      result = await rooms.admitPatient(info.roomId, patientSocketId);
    } catch (err) {
      logger.error("admitPatient error roomId=%s: %s", info.roomId, err.message);
      socket.emit("error", { message: "Internal error admitting patient" });
      return;
    }

    if (!result.ok) {
      socket.emit("error", { message: result.reason });
      return;
    }

    // Tell patient they have been admitted; include current peers so they know
    // whether to initiate or wait for an offer.
    io.to(patientSocketId).emit("admitted", {
      roomId: info.roomId,
      peers: result.peers,
    });

    // Tell provider that the patient is now an active peer
    socket.emit("peer-joined", {
      userId:   result.peer.userId,
      role:     result.peer.role,
      socketId: patientSocketId,
    });

    logger.info("admit-patient roomId=%s patientSid=%s by=%s",
      info.roomId, patientSocketId, socket.id);
  });

  // ── reject-patient ───────────────────────────────────────────────────────────
  socket.on("reject-patient", async ({ socketId: patientSocketId } = {}) => {
    if (!patientSocketId) return;

    let info;
    try {
      info = await rooms.getSocketInfo(socket.id);
    } catch (err) {
      logger.error("getSocketInfo error: %s", err.message);
      return;
    }

    if (!info) return;

    try {
      await rooms.rejectPatient(info.roomId, patientSocketId);
    } catch (err) {
      logger.error("rejectPatient error: %s", err.message);
      return;
    }

    io.to(patientSocketId).emit("rejected", {
      message: "The provider declined your session request",
    });

    logger.info("reject-patient roomId=%s patientSid=%s by=%s",
      info.roomId, patientSocketId, socket.id);
  });

  // ── offer ────────────────────────────────────────────────────────────────────
  socket.on("offer", ({ to, sdp } = {}) => {
    if (!to || !sdp) return;
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  // ── answer ───────────────────────────────────────────────────────────────────
  socket.on("answer", ({ to, sdp } = {}) => {
    if (!to || !sdp) return;
    io.to(to).emit("answer", { from: socket.id, sdp });
  });

  // ── ice-candidate ─────────────────────────────────────────────────────────────
  socket.on("ice-candidate", ({ to, candidate } = {}) => {
    if (!to || !candidate) return;
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // ── chat-message ──────────────────────────────────────────────────────────────
  const CHAT_MAX_LENGTH = 2000;
  socket.on("chat-message", async ({ message } = {}) => {
    if (!message || typeof message !== "string") return;
    if (message.length > CHAT_MAX_LENGTH) return;
    let roomId;
    try {
      roomId = await rooms.getRoomId(socket.id);
    } catch { return; }
    if (!roomId) return;
    socket.to(roomId).emit("chat-message", { from: socket.id, message });
    logger.debug("chat roomId=%s from=%s len=%d", roomId, socket.id, message.length);
  });

  // ── leave / disconnect ────────────────────────────────────────────────────────
  async function handleLeave() {
    let result;
    try {
      result = await rooms.leave(socket.id);
    } catch (err) {
      logger.error("rooms.leave error sid=%s: %s", socket.id, err.message);
      return;
    }

    if (!result) return;
    const { roomId, inLobby } = result;

    if (inLobby) {
      // Patient left before being admitted — notify provider
      socket.to(roomId).emit("patient-left-lobby", { socketId: socket.id });
    } else {
      // Active peer left — notify the other peer
      socket.to(roomId).emit("peer-left", { socketId: socket.id });
    }

    logger.info("leave roomId=%s sid=%s inLobby=%s", roomId, socket.id, inLobby);
  }

  socket.on("leave", handleLeave);
  socket.on("disconnect", handleLeave);
}

module.exports = { registerHandlers };
