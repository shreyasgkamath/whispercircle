# WhisperCircle Project Report

## Title
**WhisperCircle: Anonymous Talking Club and Discussion Platform**

## Abstract
WhisperCircle is a full-stack web application that enables people to participate in topic-based group conversations and private one-to-one chats using pseudonymous guest identities. The platform includes real-time messaging, room discovery, confessions, user blocking, message reporting, and a basic moderation queue. It is intended as an educational project demonstrating frontend development, backend APIs, real-time communication, database persistence, and safety-aware design.

## 1. Problem Statement
Some people find it difficult to join conversations when their real identity is visible. A pseudonymous platform can lower the barrier to participation, provided that users have reporting and blocking tools and clear expectations for respectful behavior.

## 2. Objectives
- Build a responsive full-stack web application.
- Provide pseudonymous guest identities.
- Support topic-based group chat and private messaging.
- Store chat history and reports.
- Add basic safety features such as reporting and blocking.
- Demonstrate teamwork, testing, GitHub collaboration, and documentation.

## 3. Proposed System
Users enter with a nickname, browse clubs, and join a room. Socket.IO delivers group messages in real time. Users can select another online member for a private chat. Messages and reports are stored in MongoDB when configured; the development fallback uses in-memory storage. Users can report harmful content and block another identity for the active server session.

## 4. Technology Stack
- React and Vite
- CSS
- Node.js and Express
- Socket.IO
- MongoDB and Mongoose
- Git and GitHub

## 5. Main Functionalities
1. Anonymous guest identity generation
2. Topic-based room discovery
3. Real-time group messaging
4. Private one-to-one messaging
5. Online room member list
6. Anonymous confessions room
7. User blocking
8. Message/user reporting
9. Basic moderator report queue

## 6. Architecture
Browser (React) communicates with Express over HTTP for room lists and moderation routes. Socket.IO carries real-time events for room membership, presence, group messages, private messages, and reports. Mongoose stores messages and reports in MongoDB. When `MONGODB_URI` is absent or unavailable, the development server falls back to in-memory storage.

## 7. Database Design
### Message
- id: unique message identifier
- roomId: group room identifier (if group message)
- senderId: pseudonymous session identity
- senderName: public nickname
- recipientId: private recipient (if private message)
- text: message body
- kind: group or private
- createdAt: timestamp

### Report
- id: report identifier
- reporterId: pseudonymous reporter
- reportedUserId: reported identity
- messageId: related message identifier
- reason and details
- status: open, reviewed, or dismissed
- createdAt: timestamp

## 8. Screenshots
Insert screenshots captured from your running application:
1. Guest entry screen
2. Room discovery screen
3. Group chat with two browser sessions
4. Private chat
5. Report submission modal
6. Moderation queue

## 9. Testing
| Test case | Expected result | Result |
|---|---|---|
| Enter with generated nickname | Dashboard opens | Fill after testing |
| Open a room | Room history loads | Fill after testing |
| Send group message | Other room members receive it | Fill after testing |
| Start private chat | Recipient receives private message | Fill after testing |
| Submit report | Confirmation appears and report is queued | Fill after testing |
| Block a user | New private messages are rejected for the active server session | Fill after testing |
| Search clubs | Room list filters by text | Fill after testing |

## 10. Division of Work
### Student 1
- React UI and responsive styling
- Guest entry and identity display
- Room discovery and chat interface
- Confession interface
- UI testing and screenshots

### Student 2
- Express backend and API routes
- Socket.IO real-time events
- MongoDB models and persistence
- Reporting, blocking, moderation queue
- Backend testing and deployment setup

Both team members contributed to integration, final testing, documentation, and presentation preparation. Adjust this section to match the actual work completed.

## 11. Limitations and Future Enhancements
- Add authenticated moderator roles and permanent bans.
- Add stronger session validation and persistent block lists.
- Add message retention controls and a privacy policy.
- Add automated abuse detection with human review.
- Add room creation, polls, reactions, and notification preferences.
- Deploy with HTTPS and production-grade secrets.

## 12. Conclusion
WhisperCircle demonstrates how a full-stack application can combine responsive user interfaces, persistent data, real-time communication, and basic community safety features. It offers a foundation for a pseudonymous discussion platform while highlighting the importance of responsible moderation and privacy.

## GitHub Link
Add your repository URL here: `https://github.com/YOUR-USERNAME/whispercircle`
