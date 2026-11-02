# WhisperCircle

**Anonymous Talking Club and Discussion Platform** — a full-stack web application for pseudonymous, topic-based conversations.

WhisperCircle lets visitors enter with a chosen or randomly generated nickname, browse six discussion clubs, chat in real time, start private conversations, share anonymous confessions, and use reporting and blocking tools.

## Features

1. **Anonymous guest identity** — enter with a chosen nickname or generate one; no sign-up is required.
2. **Topic-based room discovery** — browse six clubs: College Life, Confessions, Friends & Feelings, Gaming Zone, Music Lounge, and Anything Goes.
3. **Real-time group chat** — Socket.IO broadcasts messages to members of the selected room and loads recent room history.
4. **Online member list** — see who is currently present in a room, with live presence counts.
5. **Private one-to-one chat** — select another online member to start a private conversation.
6. **Anonymous confessions** — share thoughts in a dedicated space without displaying the public nickname on confession cards.
7. **Report messages and users** — submit a reason and optional details; the server looks up the original message when creating the report.
8. **Block users** — block private conversations for the active server session.
9. **Moderation queue** — view submitted reports and mark them reviewed or dismissed.
10. **Responsive dark interface** — desktop and narrow-screen layouts.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, CSS, lucide-react |
| Backend | Node.js, Express |
| Real-time communication | Socket.IO |
| Database | MongoDB, Mongoose (optional for local demo; in-memory fallback available) |
| Security and validation | Helmet, CORS allow-list, express-rate-limit, Zod, input sanitisation |
| Backend tests | Node.js built-in test runner |
| Version control | Git and GitHub |

## Project structure

```text
whispercircle/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/
│   │   └── index.js
│   ├── tests/
│   │   └── api.test.mjs
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

## Requirements

- Node.js 20 or newer recommended
- npm
- MongoDB local installation or MongoDB Atlas connection (optional)

Without MongoDB, the backend uses temporary in-memory storage. Messages and reports are cleared when the server restarts.

## Run locally on Windows

Open two terminals in the repository root.

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

The backend runs at `http://localhost:4000`.

The `.env.example` file contains local defaults. Leave `MONGODB_URI` blank to use in-memory storage. Do not commit your real `server/.env` file or publish credentials.

### 2. Start the frontend

In a second terminal, from the repository root:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL printed in the terminal, normally [http://localhost:5173](http://localhost:5173).

## Run backend tests

From the repository root:

```powershell
cd server
npm install
npm test
```

The included Node.js test suite starts its own test server on port 4100 and uses in-memory storage.

The supplied project report records **12/12 backend tests** and **34/34 two-browser end-to-end checks** as passing. The backend test file is included in this repository; the Playwright end-to-end test source is not currently included in the repository snapshot.

## Demo walkthrough

1. Open the app in two separate browser profiles, or use a normal and an incognito window.
2. Enter different guest nicknames.
3. Join the same room in both sessions and exchange group messages.
4. Select another online member to start a private conversation.
5. Report a message using the report action.
6. Open **Demo moderation** to view the report queue and review or dismiss a report.

## Configuration

The backend reads environment variables from `server/.env`:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port; defaults to 4000 |
| `CLIENT_ORIGIN` | Allowed frontend origin; defaults to http://localhost:5173 |
| `MONGODB_URI` | Optional MongoDB connection string |
| `DEMO_MODERATOR_KEY` | Moderator key required by the moderation API when `NODE_ENV=production` |

The moderation queue is a classroom demonstration feature, not a production moderation console. Configure real moderator authentication before public deployment.

## Privacy and safety notes

WhisperCircle provides **pseudonymous public identities, not guaranteed anonymity**. The server handles network requests and session tokens. Do not publish secrets or real personal information. Before production use, add authenticated moderator roles, persistent block/ban controls, a privacy notice, retention rules, abuse monitoring, and production-grade session handling. Do not use this demo to collect sensitive personal data.

## Team

- **Shreyas G Kamath** — frontend work: React interface, guest entry, room directory, chat screens, responsive styling.
- **Ravuru Pavan Kumar** — backend work: Express API, Socket.IO events, data persistence, reporting/blocking, moderation and backend testing.

Both contributors participate in integration, testing, GitHub updates and the final demonstration. Adjust this allocation if the actual contributions differ.

## Repository

[https://github.com/shreyasgkamath/whispercircle](https://github.com/shreyasgkamath/whispercircle)
