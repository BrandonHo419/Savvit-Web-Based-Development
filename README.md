# Savvit

**A visual bookmarking workspace for ideas, images, videos, and useful links.**

Savvit is a full-stack web application for collecting inspiration in one place. Its aim is to make content easier to save, organise into boards, revisit, and share, rather than leave it scattered across browser tabs and platforms.

> **Project status: redevelopment.** This repository contains an existing application prototype and partially integrated features. It is not yet production-ready or verified to run end to end from a fresh clone.

## What Savvit is building

- **Accounts and profiles:** registration, login, password hashing, and session-based authentication.
- **Boards and collections:** organise saved content into named groups.
- **Pins and bookmarks:** save images, destination URLs, descriptions, and imported content.
- **Discovery:** explore images and videos through experimental Pixabay and YouTube integrations.
- **Interactions:** likes, comments, threaded replies, and content management.
- **Administration:** a basic user-management interface.

These capabilities are represented in the source code, but **not all of them currently work together**. See [Current limitations](#current-limitations) and [Roadmap](#roadmap).

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript (ES modules) |
| Backend | Node.js, Express |
| Database | MySQL |
| Authentication | Passport.js (local strategy), bcrypt, express-session |
| Integrations | YouTube Data API, Pixabay API (experimental) |
| Tooling | npm, ESLint, HTML validation |

The backend currently mixes two MySQL drivers. Unifying database access is part of the redevelopment.

## Project structure

```text
.
├── app.js                 # Express app, middleware, sessions
├── bin/www                # HTTP server entry point
├── routes/                # User, pin, and board endpoint definitions
├── controllers/           # Pin and board request handlers
├── models/                # Database connection helper
├── passportStruct.js      # Local authentication strategy
├── public/
│   ├── *.html             # Existing application pages
│   ├── js/                # Frontend modules and API integrations
│   ├── css/               # Page styles
│   ├── stylesheets/       # Additional component styles
│   └── img/               # Static assets
├── database.sql           # Existing MySQL schema and development data
└── package.json           # Declared Node dependencies and scripts
```

## Local development (work in progress)

**Prerequisites:** a current Node.js LTS release, npm, and MySQL 8.

1. Clone the repository and install the currently declared dependencies:

   ```bash
   git clone https://github.com/BrandonHo419/Savvit-Web-Based-Development.git
   cd Savvit-Web-Based-Development
   npm install
   ```

2. Create a local database and import the existing development SQL dump:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS pinterest_clone;"
   mysql -u root -p pinterest_clone < database.sql
   ```

3. Create a local `.env` file (do not commit it):

   ```dotenv
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=replace-with-a-long-random-secret
   ```

4. After the dependency and routing fixes in the roadmap have been completed, start the server:

   ```bash
   npm start
   ```

   The intended local landing page is `http://localhost:3000/landingpage.html`.

**Important:** these are initial setup instructions, **not a verified working quickstart**. Several packages imported by the source are missing from `package.json`; the pin and board routers are not mounted in `app.js`; and other configuration and page references still need repair. The imported SQL includes development records, not a ready-to-use demo account.

## Current limitations

- **Application wiring:** some routes, UI references, and asset paths are incomplete or inconsistent.
- **Configuration:** database connections are hardcoded in multiple modules; the package manifest is incomplete.
- **Authentication and authorization:** resource ownership and role checks need to be enforced consistently on the server, with user identity derived from the session.
- **API credentials:** experimental frontend integrations require credential rotation and secure server-side handling before public deployment.
- **File uploads:** uploaded images need validation, sensible size limits, and durable storage.
- **Testing and deployment:** there is no verified automated test suite, reproducible container setup, or hosted public demo yet.

**Do not expose this version as a public multi-user service until the security and deployment blockers are addressed.**

## Roadmap

### Phase 1 — Make the foundation reproducible
- [ ] Fix missing npm dependencies and remove unused imports
- [ ] Consolidate MySQL configuration and move settings into environment variables
- [ ] Mount the board and pin routes; repair missing HTML and asset references
- [ ] Provide a clean schema, development seed data, and a working demo account
- [ ] Add documented setup commands and a local Docker Compose environment

### Phase 2 — Secure and stabilise
- [ ] Derive user identity from authenticated sessions, never from client-supplied IDs
- [ ] Enforce ownership, admin permissions, input validation, and safe upload handling
- [ ] Move third-party API calls requiring secrets to backend endpoints
- [ ] Use an appropriate production session store, cookie settings, and security middleware
- [ ] Add unit, API integration, and browser-level tests with CI

### Phase 3 — Improve the experience
- [ ] Polish the responsive dashboard, board management, and content-saving flow
- [ ] Implement reliable bookmark search, filtering, and useful empty/error states
- [ ] Add URL metadata previews, tags, and clearer collection organisation
- [ ] Improve accessibility, keyboard navigation, and loading performance

### Phase 4 — Publish and demonstrate
- [ ] Deploy the application with a managed database and persistent image storage
- [ ] Add a public read-only demo or safe demo-account experience
- [ ] Publish screenshots, a short walkthrough video/GIF, and architecture documentation
- [ ] Add live demo and CI links to this README when available

## Demo plan

The eventual public walkthrough will demonstrate:

1. Register or enter a seeded demo account.
2. Create a board and save a link or image as a pin.
3. Organise and retrieve saved content.
4. Search for content and, if enabled, import it from an external provider.
5. View interactions and a responsive layout on desktop and mobile.

**No live demo or screenshots are claimed at this stage.** They will be added after the core flows are working and tested.

## Project background

Savvit began as a collaborative academic web application. This repository is being developed further as an independently maintained portfolio project, with a focus on improving its architecture, security, usability, and deployability. The original collaborative work remains part of the project's history.

## Contributing and feedback

Issues and suggestions are welcome. Current work is focused on stabilising the application before expanding its feature set.
