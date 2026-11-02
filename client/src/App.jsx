import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  MessageCircle, Ghost, Search, Send, Users, ShieldAlert, LogOut,
  Hash, Plus, X, ShieldCheck, Sparkles, Heart, Music2, Gamepad2, GraduationCap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SOCKET = import.meta.env.VITE_SOCKET_URL || API;
const adjectives = ['Quiet', 'Blue', 'Midnight', 'Velvet', 'Sunny', 'Cosmic', 'Gentle', 'Misty', 'Silver', 'Lucky'];
const nouns = ['Fox', 'Comet', 'Owl', 'Leaf', 'Panda', 'Moon', 'Robin', 'Cloud', 'Otter', 'Star'];
const makeNickname = () => `${adjectives[Math.floor(Math.random()*adjectives.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}${Math.floor(10+Math.random()*90)}`;
const getIdentity = () => {
  try {
    const old = sessionStorage.getItem('wc_identity');
    if (old) return JSON.parse(old);
  } catch {}
  return null;
};
const icons = { 'college-life': GraduationCap, confessions: Sparkles, 'friends-feelings': Heart, 'gaming-zone': Gamepad2, 'music-lounge': Music2, 'anything-goes': MessageCircle };
const timeLabel = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [identity, setIdentity] = useState(getIdentity);
  const [nicknameInput, setNicknameInput] = useState('');
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tab, setTab] = useState('rooms');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showReport, setShowReport] = useState(null);
  const [reportReason, setReportReason] = useState('Harassment or bullying');
  const [reportDetails, setReportDetails] = useState('');
  const [reportList, setReportList] = useState([]);
  const [showModeration, setShowModeration] = useState(false);
  const socketRef = useRef(null);
  const activeRoomRef = useRef(null);
  const selectedUserRef = useRef(null);
  const bottomRef = useRef(null);
  activeRoomRef.current = activeRoom;
  selectedUserRef.current = selectedUser;

  useEffect(() => {
    fetch(`${API}/api/rooms`).then(r => r.json()).then(setRooms).catch(() => setError('Cannot reach the server. Start the backend on port 4000.'));
  }, []);

  useEffect(() => {
    if (!identity) return;
    const socket = io(SOCKET, { auth: identity, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect_error', e => setError(e.message || 'Could not connect to chat server.'));
    socket.on('app:error', setError);
    socket.on('session:ready', () => setError(''));
    socket.on('room:history', history => setMessages(history || []));
    socket.on('message:new', msg => setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg].slice(-150)));
    socket.on('room:presence', data => {
      setRooms(prev => prev.map(r => r.id === data.roomId ? { ...r, online: data.online } : r));
      if (data.roomId === activeRoomRef.current?.id) setMembers(data.members || []);
    });
    socket.on('message:private:new', msg => {
      const selected = selectedUserRef.current;
      if (selected && (msg.senderId === selected.id || msg.recipientId === selected.id)) {
        setPrivateMessages(prev => [...prev, msg].slice(-150));
      } else if (msg.senderId !== identity.userId) setNotice(`New private message from ${msg.senderName}`);
    });
    socket.on('private:history', data => {
      const selected = selectedUserRef.current;
      if (selected && data.otherId === selected.id) setPrivateMessages(data.messages || []);
    });
    socket.on('report:received', data => { setNotice(data.message); setShowReport(null); setReportDetails(''); });
    socket.on('user:blocked', () => { setNotice('User blocked for this session.'); setSelectedUser(null); setPrivateMessages([]); });
    return () => socket.disconnect();
  }, [identity]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, privateMessages, tab]);

  const visibleRooms = useMemo(() => rooms.filter(r => `${r.name} ${r.description}`.toLowerCase().includes(query.toLowerCase())), [rooms, query]);

  function enter() {
    const nickname = nicknameInput.trim() || makeNickname();
    if (nickname.length < 2 || nickname.length > 24) return setError('Nickname must be 2–24 characters.');
    const ident = { nickname: nickname.replace(/[<>]/g, ''), userId: crypto.randomUUID(), token: crypto.randomUUID() };
    sessionStorage.setItem('wc_identity', JSON.stringify(ident));
    setIdentity(ident); setError('');
  }
  function joinRoom(room) {
    setActiveRoom(room); setTab('chat'); setSelectedUser(null); setMessages([]); setMembers([]);
    socketRef.current?.emit('room:join', { roomId: room.id });
  }
  function openPrivate(user) {
    if (!user || user.id === identity?.userId) return;
    setSelectedUser(user); setPrivateMessages([]); setTab('private');
    socketRef.current?.emit('private:history', { otherId: user.id });
  }
  function send() {
    const text = draft.trim();
    if (!text) return;
    if (tab === 'private' && selectedUser) socketRef.current?.emit('message:private', { recipientId: selectedUser.id, text });
    else if (activeRoom) socketRef.current?.emit('message:group', { roomId: activeRoom.id, text });
    setDraft('');
  }
  function submitReport() {
    if (!showReport) return;
    socketRef.current?.emit('message:report', { messageId: showReport.id, reportedUserId: showReport.senderId, reason: reportReason, details: reportDetails });
  }
  async function loadReports() {
    try { const res = await fetch(`${API}/api/mod/reports`); if (!res.ok) throw new Error(); setReportList(await res.json()); setShowModeration(true); }
    catch { setError('Unable to load reports.'); }
  }
  async function updateReport(id, status) {
    try {
      const res = await fetch(`${API}/api/mod/reports/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status}) });
      if (!res.ok) throw new Error();
      setReportList(prev => prev.map(r => r.id === id ? {...r, status} : r));
    } catch { setError('Could not update that report.'); }
  }
  function leave() {
    socketRef.current?.emit('room:leave');
    sessionStorage.removeItem('wc_identity');
    setIdentity(null); setActiveRoom(null); setMessages([]); setSelectedUser(null); setTab('rooms');
  }

  if (!identity) return <div className="entry-shell">
    <div className="entry-card">
      <div className="brand-mark"><MessageCircle size={28}/><span className="spark">✦</span></div>
      <p className="eyebrow">YOUR SPACE, YOUR VOICE</p>
      <h1>Whisper<span>Circle</span></h1>
      <p className="entry-copy">Meet minds, share thoughts, and talk freely. Your public identity is yours to choose.</p>
      <label htmlFor="nickname">Choose an anonymous nickname</label>
      <input id="nickname" maxLength="24" value={nicknameInput} onChange={e=>setNicknameInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&enter()} placeholder={makeNickname()} />
      <button className="primary full" onClick={enter}><Ghost size={18}/> Enter the circle</button>
      <button className="text-button" onClick={()=>setNicknameInput(makeNickname())}>Generate a random nickname</button>
      {error && <p className="error">{error}</p>}
      <p className="privacy-note"><ShieldCheck size={15}/> No real name is shown in public rooms. Be kind, protect personal details.</p>
    </div>
  </div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="mini-mark"><MessageCircle size={21}/></div><div><strong>WhisperCircle</strong><small>Talk freely. Stay you.</small></div></div>
      <div className="identity-pill"><div className="avatar">{identity.nickname.slice(0,1).toUpperCase()}</div><div className="identity-text"><b>{identity.nickname}</b><small>Anonymous guest</small></div><button title="Leave session" className="icon-button" onClick={leave}><LogOut size={17}/></button></div>
      <div className="side-label">YOUR SPACE</div>
      <button className={`nav-item ${tab==='rooms'?'selected':''}`} onClick={()=>{setTab('rooms');setSelectedUser(null)}}><Hash size={18}/> Explore clubs</button>
      <button className={`nav-item ${tab==='confessions'?'selected':''}`} onClick={()=>{setTab('confessions');setActiveRoom(null);setSelectedUser(null)}}><Sparkles size={18}/> Confessions <span className="nav-dot"/></button>
      <div className="side-label room-label">TALKING CLUBS <span>{rooms.length}</span></div>
      {rooms.map(room => {const Icon=icons[room.id]||MessageCircle; return <button key={room.id} className={`nav-item room-nav ${activeRoom?.id===room.id&&tab==='chat'?'selected':''}`} onClick={()=>joinRoom(room)}><Icon size={17}/><span>{room.name}</span><small>{room.online||0}</small></button>})}
      <div className="sidebar-bottom"><div className="safe-card"><ShieldCheck size={19}/><div><b>Keep it kind</b><small>Never share private details.</small></div></div><button className="nav-item" onClick={loadReports}><ShieldAlert size={17}/> Demo moderation</button></div>
      <button className="nav-item mobile-only" title="Demo moderation" aria-label="Demo moderation" onClick={loadReports}><ShieldAlert size={18}/></button>
      <button className="nav-item mobile-only" title="Leave session" aria-label="Leave session" onClick={leave}><LogOut size={18}/></button>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div><p className="eyebrow">A LITTLE LESS ALONE</p><h2>{tab==='private'&&selectedUser?`Private chat with ${selectedUser.nickname}`:tab==='chat'&&activeRoom?activeRoom.name:tab==='confessions'?'Anonymous confessions':'Find your people'}</h2></div>
        <div className="top-actions"><div className="searchbox"><Search size={17}/><input placeholder="Search clubs..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="online-chip"><span/> Live</div></div>
      </header>
      {error && <div className="toast error-toast" onClick={()=>setError('')}>{error} <X size={15}/></div>}
      {notice && <div className="toast" onClick={()=>setNotice('')}>{notice} <X size={15}/></div>}

      {tab==='rooms' && <section className="content-scroll">
        <div className="welcome-banner"><div><span className="banner-kicker">WELCOME TO YOUR CORNER OF THE INTERNET</span><h3>Good conversations<br/>start with <em>one hello.</em></h3><p>Drop into a room, meet a new perspective, or just listen for a while.</p></div><div className="orb-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orb orb-three">✦</div></div></div>
        <div className="section-heading"><div><h3>Explore talking clubs</h3><p>Pick a room that feels right today.</p></div><span className="muted">{visibleRooms.length} CLUBS</span></div>
        <div className="room-grid">{visibleRooms.map(room=>{const Icon=icons[room.id]||MessageCircle;return <button key={room.id} className="room-card" onClick={()=>joinRoom(room)}><div className="room-card-top"><div className={`room-icon ${room.id}`}><Icon size={22}/></div><span className="live-count"><i/>{room.online||0} online</span></div><h4>{room.emoji} {room.name}</h4><p>{room.description}</p><div className="room-card-foot"><span>Join conversation</span><span>↗</span></div></button>})}</div>
        <div className="bottom-note"><Sparkles size={17}/><span>New here? You can listen first, then join in when you're ready.</span></div>
      </section>}

      {tab==='chat' && activeRoom && <section className="chat-layout">
        <div className="chat-panel">
          <div className="chat-room-head"><div className="room-icon"><MessageCircle size={20}/></div><div><b>{activeRoom.name}</b><small>{activeRoom.description}</small></div><span className="live-count"><i/>{members.length} here</span></div>
          <div className="members-strip" aria-label="People in this room">{members.filter(m=>m.id!==identity.userId).length===0?<small>You're the only one here for now.</small>:members.filter(m=>m.id!==identity.userId).map(m=><button key={m.id} className="member-chip" onClick={()=>openPrivate(m)}><span className="member-avatar">{m.nickname.slice(0,1).toUpperCase()}</span>{m.nickname}<MessageCircle size={13}/></button>)}</div>
          <div className="message-list">
            <div className="room-welcome"><div className="welcome-symbol">{activeRoom.emoji}</div><h3>Welcome to {activeRoom.name}</h3><p>Be curious, be kind, and let everyone have a voice.</p><span>MESSAGES BELOW ARE PUBLIC TO THIS ROOM</span></div>
            {messages.map(msg=><div className={`message-row ${msg.senderId===identity.userId?'mine':''}`} key={msg.id}><div className="message-avatar">{(msg.senderName||'?').slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><b>{msg.senderId===identity.userId?'You':msg.senderName}</b><time>{timeLabel(msg.createdAt)}</time>{msg.senderId!==identity.userId&&<button className="tiny-link" onClick={()=>setShowReport(msg)}>Report</button>}</div><div className="bubble">{msg.text}</div></div></div>)}
            <div ref={bottomRef}/>
          </div>
          <form className="composer" onSubmit={e=>{e.preventDefault();send()}}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} placeholder={`Message ${activeRoom.name}...`} /><span className="composer-hint">Be kind ✦</span><button className="send-button" aria-label="Send message"><Send size={18}/></button></form>
        </div>
        <aside className="members-panel"><div className="members-head"><b>In this room</b><span>{members.length}</span></div><p className="members-note">Everyone here is using an anonymous nickname.</p>{members.map(member=><button className="member-row" key={member.id} onClick={()=>openPrivate(member)}><div className="member-avatar">{member.nickname.slice(0,1).toUpperCase()}</div><span>{member.id===identity.userId?'You':member.nickname}</span>{member.id!==identity.userId&&<MessageCircle size={15}/>}</button>)}<div className="member-tip"><MessageCircle size={17}/><span>Select a member to start a private chat.</span></div></aside>
      </section>}

      {tab==='private' && selectedUser && <section className="private-layout"><div className="private-banner"><button className="outline-button back-btn" onClick={()=>{setSelectedUser(null);setTab(activeRoom?'chat':'rooms')}}>← Back</button><div className="member-avatar big">{selectedUser.nickname.slice(0,1).toUpperCase()}</div><div><b>{selectedUser.nickname}</b><p>Private conversation · anonymous identities</p></div><button className="outline-button" onClick={()=>{socketRef.current?.emit('user:block',{otherId:selectedUser.id});}}> <ShieldAlert size={15}/> Block</button></div><div className="message-list private-list">{privateMessages.length===0&&<div className="empty-state">No messages yet. Say hello to {selectedUser.nickname}!</div>}{privateMessages.map(msg=><div className={`message-row ${msg.senderId===identity.userId?'mine':''}`} key={msg.id}><div className="message-avatar">{(msg.senderName||'?').slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><b>{msg.senderId===identity.userId?'You':msg.senderName}</b><time>{timeLabel(msg.createdAt)}</time>{msg.senderId!==identity.userId&&<button className="tiny-link" onClick={()=>setShowReport(msg)}>Report</button>}</div><div className="bubble">{msg.text}</div></div></div>)}<div ref={bottomRef}/></div><form className="composer" onSubmit={e=>{e.preventDefault();send()}}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} placeholder={`Message ${selectedUser.nickname} privately...`}/><button className="send-button" aria-label="Send private message"><Send size={18}/></button></form></section>}

      {tab==='confessions' && <Confessions identity={identity} socket={socketRef.current} onReport={msg=>setShowReport(msg)} />}

      <footer className="footer"><span>WhisperCircle © 2026</span><span><ShieldCheck size={14}/> Pseudonymous by design · Kindness by choice</span></footer>
    </main>

    {showReport && <div className="modal-backdrop" onClick={()=>setShowReport(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowReport(null)}><X size={18}/></button><div className="modal-icon"><ShieldAlert size={22}/></div><h3>Report this message</h3><p>Help moderators understand what happened. Reports should be made in good faith.</p><label>Reason</label><select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option>Harassment or bullying</option><option>Hate or discrimination</option><option>Spam or scam</option><option>Sharing personal information</option><option>Other safety concern</option></select><label>Additional details (optional)</label><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={500} placeholder="Add context for the moderators..."/><button className="primary full" onClick={submitReport}>Submit report</button></div></div>}

    {showModeration && <div className="modal-backdrop" onClick={()=>setShowModeration(false)}><div className="modal reports-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowModeration(false)}><X size={18}/></button><div className="modal-icon"><ShieldCheck size={22}/></div><h3>Demo moderation queue</h3><p>This is a classroom demo. Production moderator access must be authenticated.</p>{reportList.length===0?<div className="empty-state">No reports yet. Submit a test report to see it here.</div>:reportList.map(r=><div className="report-card" key={r.id} data-status={r.status}><b>{r.reason}</b><small>Status: <span className={`status-tag ${r.status}`}>{r.status}</span> · {timeLabel(r.createdAt)}{r.reportedName?` · reported: ${r.reportedName}`:''}</small>{r.messageText&&<blockquote className="reported-text">“{r.messageText}”</blockquote>}<p>{r.details||'No additional details.'}</p>{r.status==='open'&&<div className="report-actions"><button className="outline-button" onClick={()=>updateReport(r.id,'reviewed')}>Mark reviewed</button><button className="outline-button" onClick={()=>updateReport(r.id,'dismissed')}>Dismiss</button></div>}</div>)}</div></div>}
  </div>;
}

function Confessions({ identity, socket, onReport }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');
  // Confessions use a dedicated room message stream so they remain real-time.
  useEffect(() => {
    if (!socket) return;
    socket.emit('room:join', { roomId: 'confessions' });
    const onHistory = history => setItems(history || []);
    const onMessage = msg => { if (msg.roomId === 'confessions') setItems(prev => [...prev.filter(m=>m.id!==msg.id), msg].slice(-100)); };
    socket.on('room:history', onHistory);
    socket.on('message:new', onMessage);
    return () => { socket.off('room:history', onHistory); socket.off('message:new', onMessage); };
  }, [socket]);
  function post() {
    if (!text.trim()) return;
    socket?.emit('message:group', { roomId: 'confessions', text: text.trim() });
    setText('');
    setNotice('Your confession was shared with the room.');
  }
  return <section className="confession-layout"><div className="confession-intro"><div className="confession-art">✦</div><p className="eyebrow">A SPACE WITHOUT SPOTLIGHTS</p><h3>Some thoughts just need<br/><em>a place to land.</em></h3><p>Share a thought, a tiny win, a worry, or something you've never said out loud. Please avoid names and identifying details.</p></div><div className="confession-form"><textarea value={text} onChange={e=>setText(e.target.value)} maxLength={1000} placeholder="I've been meaning to say..." /><div className="confession-form-foot"><span>{text.length}/1000 · public to this room</span><button className="primary" onClick={post}><Sparkles size={16}/> Share anonymously</button></div>{notice&&<p className="success">{notice}</p>}</div><div className="confession-feed"><div className="section-heading"><div><h3>Recent thoughts</h3><p>Shared by anonymous guests</p></div></div>{items.map(m=><article className="confession-card" key={m.id}><div className="confession-card-head"><span>🌙 Anonymous voice</span><time>{timeLabel(m.createdAt)}</time>{m.senderId!==identity.userId&&<button className="tiny-link" onClick={()=>onReport(m)}>Report</button>}</div><p>{m.text}</p></article>)}</div></section>;
}
