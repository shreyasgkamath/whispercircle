# WhisperCircle

A full-stack anonymous talking-club web application for a two-person college project.

## Features in this starter
1. Guest identity generation
2. Topic-based group rooms
3. Real-time group chat with Socket.IO
4. Private one-to-one messages
5. Online member counts
6. Block users
7. Report messages/users
8. Basic moderator report queue
9. Responsive dark interface

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Persistence: MongoDB + Mongoose (optional for local demo; in-memory fallback is included)
- Security: Helmet, API/socket rate limits, input validation, guest session token

## Requirements
- Node.js 20 or newer recommended
- npm
- MongoDB local or Atlas connection (optional; without it, data is temporary and disappears when server restarts)

## Run locally

### 1. Start the backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 2. Start the frontend in a second terminal
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in your terminal, normally `http://localhost:5173`.

If MongoDB is available, put its connection string in `server/.env` as `MONGODB_URI=...` and restart the server. The app can run without MongoDB using temporary in-memory storage.

## Run the automated tests
```bash
cd server
npm install
npm test        # 12 backend tests; starts its own server on port 4100 (in-memory storage)
```

## What changed from the starter
- Moderation API is now closed in production unless `DEMO_MODERATOR_KEY` is set and sent as the `x-demo-moderator` header.
- Reports are built on the server from the stored message (reported user + message text), so a client cannot fake them; the queue shows the quoted message.
- Private messages can be reported; private messages and reports are rate-limited.
- Mobile: members shown as a chip strip (private chat works on phones); Leave/Moderation buttons added to the bottom bar; Back button in private chat.

## Try it
- Open the app in two separate browser profiles or an incognito window.
- Enter different guest nicknames.
- Join the same room and send messages.
- Click a user in the room member list to start a private conversation.
- Use the report button on messages and the block button in a private chat.
- The moderator report list is a basic demo feature, not a production moderation console.

## Important privacy and safety notes
This project provides pseudonymous public identities, not guaranteed anonymity. The server handles network requests and session tokens. Do not publish secrets or real personal information. Before public deployment, add persistent user bans, stronger moderation workflows, a privacy notice, retention rules, and abuse monitoring. Do not use this starter to collect sensitive personal data.

## GitHub submission
1. Create a new empty repository on GitHub.
2. From the project root:
```bash
git init
git add .
git commit -m "Build WhisperCircle anonymous chat platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/whispercircle.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your GitHub username.

## Team work division (suggested)
- Student 1: React UI, guest entry, room browser, chat screens, responsive styling.
- Student 2: Express API, Socket.IO events, MongoDB models, reporting/blocking, testing and deployment.
- Both: integration, testing, screenshots, report, and presentation.

## Report screenshots to capture
1. Guest entry / identity screen
2. Room directory
3. Live group chat with two browser sessions
4. Private chat
5. Report submission
6. Moderator report queue

## Project report outline
- Title page
- Abstract
- Problem statement and objectives
- Existing system and proposed system
- Technology stack
- System architecture
- Feature descriptions
- Database design
- Screenshots and test cases
- Division of work
- Limitations and future enhancements
- Conclusion
- GitHub repository link
