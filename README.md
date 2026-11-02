# WhisperCircle

A full-stack anonymous talking-club web application built as a two-person college project. Users can join topic-based rooms, chat in real time, start private conversations, share confessions, and report or block harmful users.

## Features

1. Anonymous guest identity generation
2. Topic-based room discovery
3. Real-time group messaging with Socket.IO
4. Private one-to-one messaging
5. Live room member counts
6. Anonymous confessions room
7. User blocking
8. Message and user reporting
9. Basic moderator report queue
10. Responsive dark interface

## Technology stack

- **Frontend:** React, Vite, CSS
- **Backend:** Node.js, Express
- **Real-time communication:** Socket.IO
- **Database:** MongoDB and Mongoose (optional for local demo; in-memory fallback is included)
- **Security:** Helmet, API rate limiting, input validation, guest session token

## Requirements

- Node.js 20 or newer recommended
- npm
- MongoDB local installation or MongoDB Atlas connection (optional)

Without MongoDB, the server uses temporary in-memory storage. Messages and reports are cleared when the server restarts.

## Run locally on Windows

Open two terminals in the project root.

### 1. Configure and start the backend

PowerShell:

```powershell
cd server
Copy-Item .env.example .env
npm install
npm run dev
```

Command Prompt:

```cmd
cd server
copy .env.example .env
npm install
npm run dev
```

The backend runs on `http://localhost:4000`.

The `.env.example` file contains safe local defaults. MongoDB is optional; leave `MONGODB_URI` blank to use in-memory storage. Do not commit your real `.env` file or share secrets.

### 2. Start the frontend

In a second terminal, from the project root:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally [http://localhost:5173](http://localhost:5173).

## Run automated backend tests

From the project root:

```powershell
cd server
npm install
npm test
```

The Node.js test runner starts its own test server on port 4100 and uses in-memory storage.

## Demo walkthrough

1. Open the application in two separate browser profiles, or use a normal and an incognito window.
2. Enter different guest nicknames.
3. Join the same room in both sessions and exchange group messages.
4. Select another online member to start a private conversation.
5. Submit a report using the report action on a message.
6. Open **Demo moderation** to view the report queue.

## Configuration

The backend reads environment variables from `server/.env`:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default: 4000) |
| `CLIENT_ORIGIN` | Allowed frontend origin (default: http://localhost:5173) |
| `MONGODB_URI` | Optional MongoDB connection string |
| `DEMO_MODERATOR_KEY` | Optional moderator key; required to access moderation routes when `NODE_ENV=production` |

The moderation interface is a demonstration feature, not a production moderation console. Configure real moderator authentication before public deployment.

## Privacy and safety

WhisperCircle provides pseudonymous public identities, not guaranteed anonymity. The server processes network requests and session tokens. Do not publish secrets or real personal information. Before production use, add stronger moderator authentication, persistent block/ban controls, a privacy notice, retention rules, and abuse monitoring. Do not use this demo to collect sensitive personal data.

## Repository

[https://github.com/shreyasgkamath/whispercircle](https://github.com/shreyasgkamath/whispercircle)
