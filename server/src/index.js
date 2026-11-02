import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { z } from 'zod';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const app = express();
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e5
});

const roomList = [
  { id: 'college-life', name: 'College Life', description: 'Campus stories, study life and everyday chaos.', emoji: '🎓' },
  { id: 'confessions', name: 'Confessions', description: 'Share a thought without attaching your public identity.', emoji: '💭' },
  { id: 'friends-feelings', name: 'Friends & Feelings', description: 'Friendship, relationships and emotional support.', emoji: '💜' },
  { id: 'gaming-zone', name: 'Gaming Zone', description: 'Games, fandoms and friendly debates.', emoji: '🎮' },
  { id: 'music-lounge', name: 'Music Lounge', description: 'Songs, artists and listening recommendations.', emoji: '🎧' },
  { id: 'anything-goes', name: 'Anything Goes', description: 'A relaxed room for general conversation.', emoji: '✨' }
];

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  roomId: String, senderId: String, senderName: String, recipientId: String,
  text: { type: String, required: true, maxlength: 1000 },
  kind: { type: String, enum: ['group', 'private'], default: 'group' },
  createdAt: { type: Date, default: Date.now }
});
const reportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  reporterId: String, reportedUserId: String, reportedName: String, messageId: String,
  messageText: String, roomId: String, kind: String,
  reason: String, details: String, status: { type: String, default: 'open' },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);
const Report = mongoose.model('Report', reportSchema);

// In-memory fallback makes the starter easy to run before MongoDB is configured.
let mongoReady = false;
const memoryMessages = [];
const memoryReports = [];
const recentMessages = new Map();
const activeUsers = new Map(); // socket id -> public guest identity
const blockedPairs = new Set();

const id = () => crypto.randomUUID();
const cleanText = (v, max = 1000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const publicUser = (u) => ({ id: u.id, nickname: u.nickname });
const isBlocked = (a, b) => blockedPairs.has(`${a}:${b}`) || blockedPairs.has(`${b}:${a}`);

// Moderator gate (demo). In production a key MUST be configured and sent in x-demo-moderator.
function moderatorAllowed(req) {
  if (process.env.NODE_ENV !== 'production') return true;
  const key = process.env.DEMO_MODERATOR_KEY;
  return Boolean(key) && req.header('x-demo-moderator') === key;
}
// Per-user throttle used for private messages and reports (ms between actions).
function throttled(userId, bucket, gapMs) {
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  if (now - (recentMessages.get(key) || 0) < gapMs) return true;
  recentMessages.set(key, now);
  return false;
}
async function findMessage(messageId) {
  if (!messageId) return null;
  if (mongoReady) return Message.findOne({ id: messageId }).lean();
  return memoryMessages.find(m => m.id === messageId) || null;
}

async function saveMessage(data) {
  if (mongoReady) {
    try { await Message.create(data); } catch (e) { console.error('Message save failed:', e.message); }
  } else memoryMessages.push(data);
}
async function saveReport(data) {
  if (mongoReady) {
    try { await Report.create(data); } catch (e) { console.error('Report save failed:', e.message); }
  } else memoryReports.push(data);
}
async function getRecent(roomId, kind = 'group', userId = null) {
  if (mongoReady) {
    const q = kind === 'group' ? { roomId, kind: 'group' } :
      { kind: 'private', $or: [{ senderId: userId }, { recipientId: userId }] };
    return Message.find(q).sort({ createdAt: -1 }).limit(50).lean().then(rows => rows.reverse());
  }
  return memoryMessages.filter(m => kind === 'group'
    ? m.kind === 'group' && m.roomId === roomId
    : m.kind === 'private' && (m.senderId === userId || m.recipientId === userId)).slice(-50);
}
function onlineCount(roomId) {
  let count = 0;
  for (const [sid, u] of activeUsers) if (u.roomId === roomId) count++;
  return count;
}
function roomMembers(roomId) {
  const seen = new Map();
  for (const u of activeUsers.values()) if (u.roomId === roomId) seen.set(u.id, publicUser(u));
  return [...seen.values()];
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoReady ? 'mongodb' : 'memory' }));
app.get('/api/rooms', (_req, res) => {
  res.json(roomList.map(r => ({ ...r, online: onlineCount(r.id) })));
});
app.get('/api/mod/reports', async (req, res) => {
  // Demo-only gate. Replace with real moderator authentication before public deployment.
  if (!moderatorAllowed(req)) return res.status(403).json({ error: 'Moderator access is not configured.' });
  const reports = mongoReady ? await Report.find().sort({ createdAt: -1 }).limit(100).lean() : memoryReports.slice(-100).reverse();
  res.json(reports);
});
app.patch('/api/mod/reports/:id', async (req, res) => {
  if (!moderatorAllowed(req)) return res.status(403).json({ error: 'Moderator access is not configured.' });
  const status = z.enum(['reviewed', 'dismissed']).safeParse(req.body?.status);
  if (!status.success) return res.status(400).json({ error: 'Invalid status.' });
  let found;
  if (mongoReady) found = (await Report.updateOne({ id: req.params.id }, { status: status.data })).matchedCount > 0;
  else {
    const report = memoryReports.find(r => r.id === req.params.id);
    if (report) report.status = status.data;
    found = Boolean(report);
  }
  if (!found) return res.status(404).json({ error: 'Report not found.' });
  res.json({ ok: true });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const nickname = cleanText(socket.handshake.auth?.nickname, 24);
  const userId = cleanText(socket.handshake.auth?.userId, 80);
  if (!token || !userId || nickname.length < 2) return next(new Error('Please create a guest identity first.'));
  // The client holds a random session token. The server associates it with this connection.
  socket.data.user = { id: userId, nickname, token };
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  activeUsers.set(socket.id, { ...user, roomId: null, socketId: socket.id });
  socket.emit('session:ready', { user: publicUser(user) });

  socket.on('room:join', async (payload = {}) => {
    const roomId = cleanText(payload.roomId, 40);
    if (!roomList.some(r => r.id === roomId)) return socket.emit('app:error', 'That room does not exist.');
    const active = activeUsers.get(socket.id);
    if (active?.roomId) socket.leave(active.roomId);
    active.roomId = roomId;
    socket.join(roomId);
    socket.emit('room:history', await getRecent(roomId));
    io.to(roomId).emit('room:presence', { roomId, members: roomMembers(roomId), online: onlineCount(roomId) });
  });

  socket.on('room:leave', () => {
    const active = activeUsers.get(socket.id);
    if (active?.roomId) {
      const old = active.roomId;
      socket.leave(old); active.roomId = null;
      io.to(old).emit('room:presence', { roomId: old, members: roomMembers(old), online: onlineCount(old) });
    }
  });

  socket.on('message:group', async (payload = {}) => {
    const text = cleanText(payload.text, 1000);
    const roomId = cleanText(payload.roomId, 40);
    const active = activeUsers.get(socket.id);
    if (!text || !active || active.roomId !== roomId || text.length > 1000) return;
    const key = `${active.id}:group`;
    const now = Date.now();
    const last = recentMessages.get(key) || 0;
    if (now - last < 500) return socket.emit('app:error', 'Slow down a little before sending another message.');
    recentMessages.set(key, now);
    const msg = { id: id(), roomId, senderId: user.id, senderName: user.nickname, text, kind: 'group', createdAt: new Date() };
    await saveMessage(msg);
    io.to(roomId).emit('message:new', msg);
  });

  socket.on('message:private', async (payload = {}) => {
    const text = cleanText(payload.text, 1000);
    const recipientId = cleanText(payload.recipientId, 80);
    if (!text || !recipientId || recipientId === user.id) return;
    if (isBlocked(user.id, recipientId)) return socket.emit('app:error', 'This conversation is blocked.');
    if (throttled(user.id, 'private', 500)) return socket.emit('app:error', 'Slow down a little before sending another message.');
    const recipientSocket = [...activeUsers.entries()].find(([, u]) => u.id === recipientId)?.[0];
    const msg = { id: id(), senderId: user.id, senderName: user.nickname, recipientId, text, kind: 'private', createdAt: new Date() };
    await saveMessage(msg);
    socket.emit('message:private:new', msg);
    if (recipientSocket) io.to(recipientSocket).emit('message:private:new', msg);
  });

  socket.on('private:history', async (payload = {}) => {
    const otherId = cleanText(payload.otherId, 80);
    if (!otherId || isBlocked(user.id, otherId)) return socket.emit('private:history', { otherId, messages: [] });
    const all = mongoReady
      ? await Message.find({ kind: 'private', $or: [
          { senderId: user.id, recipientId: otherId }, { senderId: otherId, recipientId: user.id }
        ] }).sort({ createdAt: -1 }).limit(50).lean().then(rows => rows.reverse())
      : memoryMessages.filter(m => m.kind === 'private' &&
          ((m.senderId === user.id && m.recipientId === otherId) || (m.senderId === otherId && m.recipientId === user.id))).slice(-50);
    socket.emit('private:history', { otherId, messages: all });
  });

  socket.on('user:block', (payload = {}) => {
    const otherId = cleanText(payload.otherId, 80);
    if (!otherId || otherId === user.id) return;
    blockedPairs.add(`${user.id}:${otherId}`);
    socket.emit('user:blocked', { otherId });
  });

  socket.on('message:report', async (payload = {}) => {
    const messageId = cleanText(payload.messageId, 80);
    const reason = cleanText(payload.reason, 100);
    const details = cleanText(payload.details, 500);
    if (!reason) return socket.emit('app:error', 'Choose a reason for the report.');
    if (throttled(user.id, 'report', 2000)) return socket.emit('app:error', 'Please wait a moment before sending another report.');
    // Look the message up on the server so the report reflects what was really said, not what the client claims.
    const original = await findMessage(messageId);
    const reportedUserId = original ? original.senderId : cleanText(payload.reportedUserId, 80);
    if (!reportedUserId || reportedUserId === user.id) return socket.emit('app:error', 'You cannot report that message.');
    // Private messages can only be reported by the person who received them.
    if (original?.kind === 'private' && original.recipientId !== user.id) return socket.emit('app:error', 'You cannot report that message.');
    await saveReport({
      id: id(), reporterId: user.id, reportedUserId, reportedName: original?.senderName || '',
      messageId, messageText: original?.text || '', roomId: original?.roomId || '', kind: original?.kind || '',
      reason, details, status: 'open', createdAt: new Date()
    });
    socket.emit('report:received', { message: 'Report submitted. Thank you for helping keep the community safe.' });
  });

  socket.on('disconnect', () => {
    const active = activeUsers.get(socket.id);
    activeUsers.delete(socket.id);
    if (![...activeUsers.values()].some(u => u.id === user.id)) {
      for (const b of ['group', 'private', 'report']) recentMessages.delete(`${user.id}:${b}`);
    }
    if (active?.roomId) io.to(active.roomId).emit('room:presence', {
      roomId: active.roomId, members: roomMembers(active.roomId), online: onlineCount(active.roomId)
    });
  });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      mongoReady = true;
      console.log('Connected to MongoDB.');
    } catch (e) {
      console.warn('MongoDB unavailable; using temporary in-memory storage:', e.message);
    }
  } else console.warn('MONGODB_URI not set; using temporary in-memory storage.');
  server.listen(PORT, () => console.log(`WhisperCircle API running on http://localhost:${PORT}`));
}
start();
