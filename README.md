# Savvit

**A visual bookmarking workspace for ideas, images, videos, and useful links.**

I'm building Savvit as a portfolio project for collecting images and useful links. I want to make saved ideas easy to organise into boards, revisit and share.

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

5. Apply `migrations/008_board_viewers.sql` to the selected database using the
   MySQL client (`SOURCE C:/path/to/Savvit-Web/migrations/008_board_viewers.sql;`).
   This is required for both fresh databases and upgrades; see Stage 8 below.
6. Run `npm start` and open `http://localhost:3000/landingpage.html`.
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

The tests use Node's built-in runner and ephemeral local HTTP ports. Smoke
checks cover the landing page, redirects, anonymous API rejection and CSRF.
Authorization tests use real Express routes, Passport login and session cookies
with two ordinary accounts and an administrator, backed by a deterministic
database substitute. They cover forged identities, private reads, writes to
another account's resources, admin permissions, replies, uploads and encoded
upload URLs. Frontend helper tests check session loading and CSRF headers.

These tests do not read your `.env` or connect to MySQL. The authorization suite
creates and removes temporary upload fixtures. Expected database-failure tests
may print simulated errors; use the final pass/fail summary. SQL execution,
real-database integrity and browser interactions still need integration checks.

### Current access rules

- Board and pin APIs still require login; anonymous public browsing is pending.
- New boards are private. Existing board visibility is unchanged.
- Owners can read their private boards; other authenticated users can read only
  public boards or semi-private boards on which they have an explicit viewer grant.
- A pin inherits access from its original board (`pins.board_id`). A pin with
  no valid original board is inaccessible until its data is repaired.
- Creating pins and saving references require ownership of the destination.
  Moving or deleting originals requires ownership of both the pin and its
  original board. Public visibility never grants editing rights.
- Client-supplied identity fields are ignored for content mutations. User IDs
  in listing URLs select whose boards to list; visibility is still checked
  against the authenticated session. Admin deletion IDs identify the target,
  and the administrator's role is checked separately.
- `/users/profile` supplies the signed-in `user_id` and CSRF token. Frontend
  board initialization waits for that profile; mutations send its CSRF token.
- `/users/user_info`, `/users/admin_add_user` and `/users/admin_del_user` require
  an administrator role on the server.
- Direct local upload requests require login and access through a pin's original
  board. Private responses use `Cache-Control: private, no-store`. Provider
  imports require HTTP(S) image URLs and cannot claim local upload paths.

### Local database verification still required

Use a disposable database and two separate browser profiles to avoid sharing
session cookies. Register accounts A and B, create a board as each, and verify
that each account sees its own new private board. As B, try requesting A's
board/pin IDs: private resources should return 404, while unauthenticated API
requests return 401. Confirm ordinary accounts receive 403 from user-info and
admin operations. Test a normal owner action after each rejection.

Board creation sends the CSRF header. Home now exposes Create Board and links
collections to `board.html?board_id=...`; pin details load `view_modal.html`.
The detail Save control adds a `board_pins` reference without moving the original.
Board contents, counts and thumbnail selection include originals and accessible
references without duplicates. Unavailable references are omitted, including
from counts and thumbnails. Saving membership and its engagement is transactional;
repeat saves do not add duplicate engagement records.

The new `GET /boards/:board_id` endpoint returns accessible board metadata and an
`is_owner` flag; the server still enforces all permissions independently of the UI.
No schema migration or backfill is needed: existing originals continue to appear
through `pins.board_id`. Semi-private viewer grants are described in Stage 8. Restricted board
deletion is described in Stage 7. Individual saved references can be removed as described in Stage 6.

Manual workflow check:

1. Log in, open Home, create board A, and confirm navigation to its board page.
2. Add an image pin with a title and HTTP(S) destination URL; reload to check persistence.
3. Create board B, return to A, open the pin and save it to B.
4. Open B and confirm the same pin appears; A must still contain the original.
5. Save it to B again: B should show one copy and its count should not increase.
6. In a second browser profile, log in as another account. The new private boards
   and their pins must remain inaccessible. Existing public originals may be read
   and saved, but cannot be moved or deleted by that account.
7. Enter literal HTML-like text in a board name, pin title or comment. It should
   display as text, not create HTML elements or execute scripts.

Browser layout and real MySQL execution have not yet been verified in this
workspace. The automated authorization tests use a controlled database substitute;
they check membership, privacy changes, duplicate saves and rollback behaviour.
Upload validation, safe HTML rendering, transactions, persistent sessions and
full input validation also remain required before public deployment.

## Current limitations

- **Application wiring:** some routes, UI references, and asset paths are incomplete or inconsistent.
- **Configuration:** active database settings use environment variables, but connection pools are duplicated and unused legacy routing code remains.
- **Authentication and authorization:** session-derived identity, ownership and admin checks are implemented for active routes; semi-private viewer grants are implemented; real-database/browser verification is pending.
- **API credentials:** revoked legacy values must be removed wherever they remain; replacement credentials require secure server-side handling before public deployment.
- **File uploads:** uploaded images need validation, sensible size limits, and durable storage.
- **Testing and deployment:** smoke and database-substituted authorization tests exist; real-database and browser coverage, reproducible containers, and a hosted demo remain pending.

**Do not expose this version as a public multi-user service until the security and deployment blockers are addressed.**

## Roadmap

### Phase 1 — Make the foundation reproducible
- [ ] Remove unused legacy imports and dependencies after verification
- [ ] Consolidate the environment-configured MySQL connection pools
- [x] Mount the board and pin routes
- [x] Add board and pin-detail pages
- [ ] Audit remaining legacy HTML and asset references
- [ ] Provide a clean schema, development seed data, and a working demo account
- [ ] Add documented setup commands and a local Docker Compose environment

### Phase 2 — Secure and stabilise
- [x] Derive user identity from authenticated sessions, never from client-supplied IDs
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
