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

The active backend uses mysql2 through separate callback and promise connection pools. The older mysql dependency remains declared; consolidating database access is future work.

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

## Local development

Use Node.js 24, npm, and MySQL 8. The smoke tests require Node.js 18 or later.

1. Clone this repository and run `npm ci` to install the locked dependencies.
2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell).
3. Set `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for your local MySQL account.
   Generate a session secret with the command below and put its output in
   `SESSION_SECRET`. Keep `.env` private.

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Import the development dump into a new, disposable database. **The dump
   contains DROP TABLE statements and replaces existing tables and data.**
   In the MySQL client, run the following, adapting the file path:

   ```sql
   CREATE DATABASE pinterest_clone;
   USE pinterest_clone;
   SOURCE C:/path/to/Savvit-Web-Based-Development/database.sql;
   ```

   If that database already exists, choose a new database name and update
   `DB_NAME` rather than importing over data you want to keep. Development
   records in the dump are not a documented demo account.

5. Run `npm start` and open `http://localhost:3000/landingpage.html`.
   In PowerShell, use `npm.cmd ci`, `npm.cmd test`, and `npm.cmd start` if
   execution policy blocks the npm PowerShell wrapper.

The active board and pin routers are mounted and database settings are read
from the environment. The unused `routes/index.js` is not mounted and imports
packages outside the current manifest; it is not part of this startup path.
External discovery is optional and may fail while provider keys are unavailable.
Do not put replacement credentials in public JavaScript. Backend provider-key
configuration has not yet been implemented.

### Baseline checks

```bash
npm test
```

The tests use Node's built-in runner and an ephemeral local HTTP port. They
check the landing page, root redirect, rejection of anonymous API reads, and
rejection of a mutation without a CSRF token. They do not use your `.env` or
connect to MySQL. They do **not** verify login, database queries, account
isolation, uploads, or browser interactions. Those require subsequent integration
and browser tests against an isolated database.

## Current limitations

- **Application wiring:** some routes, UI references, and asset paths are incomplete or inconsistent.
- **Configuration:** active database settings use environment variables, but connection pools are duplicated and unused legacy routing code remains.
- **Authentication and authorization:** resource ownership and role checks need to be enforced consistently on the server, with user identity derived from the session.
- **API credentials:** revoked legacy values must be removed wherever they remain; replacement credentials require secure server-side handling before public deployment.
- **File uploads:** uploaded images need validation, sensible size limits, and durable storage.
- **Testing and deployment:** basic HTTP smoke checks exist; database, authorization and browser coverage, a reproducible container setup, and a hosted public demo are still pending.

**Do not expose this version as a public multi-user service until the security and deployment blockers are addressed.**

## Roadmap

### Phase 1 — Make the foundation reproducible
- [ ] Remove unused legacy imports and dependencies after verification
- [ ] Consolidate the environment-configured MySQL connection pools
- [x] Mount the board and pin routes
- [ ] Repair missing HTML and asset references
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
