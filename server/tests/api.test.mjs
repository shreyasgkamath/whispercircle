// Backend tests. Run with:  npm test      (starts its own server on port 4100, in-memory storage)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io as connect } from 'socket.io-client';
import crypto from 'node:crypto';

const PORT = 4100, BASE = `http://localhost:${PORT}`;
let proc;
const startServer = (env = {}) => new Promise((resolve, reject) => {
  const p = spawn('node', ['src/index.js'], { env: { ...process.env, PORT, MONGODB_URI: '', CLIENT_ORIGIN: 'http://localhost:5173', ...env } });
  p.stdout.on('data', d => String(d).includes('running') && resolve(p));
  p.on('error', reject);
  setTimeout(() => reject(new Error('server did not start')), 8000);
});
const client = (nickname) => new Promise((resolve, reject) => {
  const userId = crypto.randomUUID();
  const s = connect(BASE, { auth: { nickname, userId, token: crypto.randomUUID() }, transports: ['websocket'] });
  s.userId = userId;
  s.on('session:ready', () => resolve(s));
  s.on('connect_error', reject);
});
const once = (s, ev, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms); s.once(ev, d => { clearTimeout(t); res(d); }); });
const wait = ms => new Promise(r => setTimeout(r, ms));

before(async () => { proc = await startServer(); });
after(() => proc?.kill());

test('GET /api/health reports the storage mode', async () => {
  const body = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(body.ok, true);
  assert.equal(body.database, 'memory');
});

test('GET /api/rooms returns the six clubs with online counts', async () => {
  const rooms = await (await fetch(`${BASE}/api/rooms`)).json();
  assert.equal(rooms.length, 6);
  assert.ok(rooms.every(r => r.id && r.name && typeof r.online === 'number'));
});

test('socket connection without a nickname is rejected', async () => {
  await assert.rejects(() => new Promise((res, rej) => {
    const s = connect(BASE, { auth: { token: 'x', userId: 'y', nickname: '' }, transports: ['websocket'], reconnection: false });
    s.on('connect_error', e => rej(e)); s.on('session:ready', res);
  }), /guest identity/);
});

test('group message reaches everyone in the room, and only that room', async () => {
  const [a, b, c] = await Promise.all([client('Alice'), client('Bob'), client('Carol')]);
  a.emit('room:join', { roomId: 'gaming-zone' }); b.emit('room:join', { roomId: 'gaming-zone' }); c.emit('room:join', { roomId: 'music-lounge' });
  await wait(300);
  let leaked = false; c.on('message:new', () => (leaked = true));
  const got = once(b, 'message:new');
  a.emit('message:group', { roomId: 'gaming-zone', text: '  hello room  ' });
  const msg = await got;
  assert.equal(msg.text, 'hello room');
  assert.equal(msg.senderName, 'Alice');
  await wait(300);
  assert.equal(leaked, false);
  [a, b, c].forEach(s => s.disconnect());
});

test('invalid room and empty message are ignored / rejected', async () => {
  const a = await client('Dana');
  const err = once(a, 'app:error');
  a.emit('room:join', { roomId: 'does-not-exist' });
  assert.match(await err, /does not exist/);
  a.emit('room:join', { roomId: 'anything-goes' });
  await wait(200);
  let got = false; a.on('message:new', () => (got = true));
  a.emit('message:group', { roomId: 'anything-goes', text: '    ' });
  await wait(400);
  assert.equal(got, false);
  a.disconnect();
});

test('rapid group messages are throttled', async () => {
  const a = await client('Eve');
  a.emit('room:join', { roomId: 'anything-goes' }); await wait(200);
  a.emit('message:group', { roomId: 'anything-goes', text: 'one' });
  const err = once(a, 'app:error');
  a.emit('message:group', { roomId: 'anything-goes', text: 'two' });
  assert.match(await err, /Slow down/);
  a.disconnect();
});

test('private message goes to sender and recipient only; history is stored', async () => {
  const [a, b, c] = await Promise.all([client('Fay'), client('Gus'), client('Hal')]);
  let leaked = false; c.on('message:private:new', () => (leaked = true));
  const toB = once(b, 'message:private:new'), echoA = once(a, 'message:private:new');
  a.emit('message:private', { recipientId: b.userId, text: 'psst' });
  assert.equal((await toB).text, 'psst'); await echoA;
  const hist = once(b, 'private:history');
  b.emit('private:history', { otherId: a.userId });
  const h = await hist;
  assert.equal(h.messages.length, 1);
  await wait(300); assert.equal(leaked, false);
  [a, b, c].forEach(s => s.disconnect());
});

test('blocking stops private messages in both directions', async () => {
  const [a, b] = await Promise.all([client('Ivy'), client('Jon')]);
  const blocked = once(a, 'user:blocked');
  a.emit('user:block', { otherId: b.userId }); await blocked;
  const err1 = once(b, 'app:error'); b.emit('message:private', { recipientId: a.userId, text: 'hi?' });
  assert.match(await err1, /blocked/);
  await wait(600);
  const err2 = once(a, 'app:error'); a.emit('message:private', { recipientId: b.userId, text: 'hi?' });
  assert.match(await err2, /blocked/);
  [a, b].forEach(s => s.disconnect());
});

test('reports store the real message text and appear in the moderation queue', async () => {
  const [a, b] = await Promise.all([client('Kim'), client('Lee')]);
  a.emit('room:join', { roomId: 'college-life' }); b.emit('room:join', { roomId: 'college-life' }); await wait(300);
  const m = once(b, 'message:new');
  a.emit('message:group', { roomId: 'college-life', text: 'rude message' });
  const msg = await m;
  const ok = once(b, 'report:received');
  // The client lies about the reported user; the server must use the stored sender instead.
  b.emit('message:report', { messageId: msg.id, reportedUserId: 'someone-else', reason: 'Harassment or bullying', details: 'test' });
  await ok;
  const list = await (await fetch(`${BASE}/api/mod/reports`)).json();
  const r = list.find(x => x.messageId === msg.id);
  assert.ok(r); assert.equal(r.reportedUserId, a.userId); assert.equal(r.messageText, 'rude message'); assert.equal(r.status, 'open');
  [a, b].forEach(s => s.disconnect());
});

test('reporting without a reason is rejected', async () => {
  const a = await client('Moe');
  const e1 = once(a, 'app:error'); a.emit('message:report', { messageId: 'x', reportedUserId: 'y', reason: '' });
  assert.match(await e1, /reason/);
  a.disconnect();
});

test('moderator can review and dismiss; bad status / unknown id are rejected', async () => {
  const list = await (await fetch(`${BASE}/api/mod/reports`)).json();
  const id = list[0].id;
  const patch = (rid, status) => fetch(`${BASE}/api/mod/reports/${rid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  assert.equal((await patch(id, 'reviewed')).status, 200);
  assert.equal((await patch(id, 'banana')).status, 400);
  assert.equal((await patch('nope', 'dismissed')).status, 404);
  const after = await (await fetch(`${BASE}/api/mod/reports`)).json();
  assert.equal(after.find(r => r.id === id).status, 'reviewed');
});

test('production mode: moderation API is closed unless a key is configured and sent', async () => {
  const prod = spawn('node', ['src/index.js'], { env: { ...process.env, PORT: 4101, NODE_ENV: 'production', MONGODB_URI: '' } });
  await new Promise(r => prod.stdout.on('data', d => String(d).includes('running') && r()));
  try {
    const r = await fetch('http://localhost:4101/api/mod/reports');
    assert.equal(r.status, 403);
  } finally { prod.kill(); }
  const keyed = spawn('node', ['src/index.js'], { env: { ...process.env, PORT: 4102, NODE_ENV: 'production', DEMO_MODERATOR_KEY: 's3cret', MONGODB_URI: '' } });
  await new Promise(r => keyed.stdout.on('data', d => String(d).includes('running') && r()));
  try {
    assert.equal((await fetch('http://localhost:4102/api/mod/reports')).status, 403);
    assert.equal((await fetch('http://localhost:4102/api/mod/reports', { headers: { 'x-demo-moderator': 's3cret' } })).status, 200);
  } finally { keyed.kill(); }
});
