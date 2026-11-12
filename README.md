# Savvit

**A visual bookmarking workspace for images, ideas and useful links.**

I'm building Savvit as a portfolio project for collecting images and useful links. I want to make saved ideas easy to organise into boards, revisit and share.

> **Project status: portfolio development.** I've implemented the core board, pin and sharing workflows, with automated regression tests and browser checks using fixture data. A hosted demo and end-to-end verification against real MySQL remain outstanding.

## What Savvit does

- **Accounts and profiles:** registration, login, password hashing, and session-based authentication.
- **Boards and collections:** create boards, search and sort collections, manage visibility, and grant selected accounts viewing access.
- **Pins and bookmarks:** upload images, edit titles and descriptions, search pins, save references, and move owned originals between boards.
- **Discovery:** browse public boards and boards explicitly shared with your account. Browsing requires sign-in.
- **Interactions:** likes, comments, threaded replies, and content management.
- **Administration:** a basic user-management interface.
- **Appearance and accessibility:** responsive layouts, light/dark/system themes, saved appearance preferences, labelled forms and keyboard-accessible dialogs.

I'm keeping external provider integrations separate from the core experience. YouTube and Pixabay discovery are not currently available in the active UI. See [Current limitations](#current-limitations) for the remaining release work.

## Skills demonstrated

I use Savvit to demonstrate practical full-stack development through working features and inspectable tests.

| Skill | How I apply it in Savvit | Implementation |
| --- | --- | --- |
| JavaScript and frontend development | I use ES modules, asynchronous requests and DOM rendering to build searchable boards and interactive pin details. | [Board UI](public/js/boardstuff/board.js), [pin interactions](public/js/boardstuff/pin_discussion.js) |
| Node.js and Express | I organise HTTP endpoints into routers, controllers and middleware, with validation and consistent ownership checks. | [Routes](routes/), [controllers](controllers/), [authorization](middleware/authorization.js) |
| SQL and relational modelling | I distinguish original pins from saved references, query access through related boards, and use transactions for dependent-record deletion. | [Board queries](controllers/boardController.js), [transactional deletion](models/pinDeletion.js), [schema](database.sql) |
| Authentication and access control | I work with Passport, bcrypt, session-derived identity, CSRF protection and private/public/granted-viewer permissions. | [Passport configuration](passportStruct.js), [application middleware](app.js), [access tests](tests/authorization.test.js) |
| Responsive CSS and accessibility | I use shared theme tokens, responsive grids, semantic labels, visible focus and modal focus management. | [Design system](public/stylesheets/design-system.css), [dialog accessibility](public/js/dialog-accessibility.js) |
| Automated testing and debugging | I test authorization failures, request races, duplicate submissions, rollback behaviour and browser layouts. | [Tests](tests/), [browser runner](scripts/browser-ui.cjs), [MySQL runner](scripts/mysql-integration.cjs) |
| Product and interaction design | I make saving a reference distinct from moving an original, preserve failed drafts, and provide loading, empty and retry states. | [Pin actions](public/js/boardstuff/pin_actions.js), [discussion tests](tests/pin-interactions.test.js) |

### Portfolio summary

> I extended Savvit, originally a collaborative academic project, into a portfolio-focused image and link bookmarking application using JavaScript, Express and MySQL. My redevelopment work focuses on ownership-aware sharing, reliable board and pin workflows, responsive themes, keyboard accessibility and regression testing.

For a resume project entry, I would highlight:

- Extended an Express/MySQL application with private, public and explicitly shared boards, enforcing session-based identity and ownership on content operations.
- Built searchable board and pin interfaces, original/reference management, metadata editing, likes and threaded discussions using vanilla JavaScript.
- Introduced a shared responsive design system and accessible modal behaviour; verified layouts across eleven pages at desktop, tablet and narrow mobile widths using headless Chrome.

### Engineering decisions I can discuss

- **References instead of copies:** saving a pin creates a membership relationship, so the original image and metadata remain the source of truth. Visibility changes must also affect saved references.
- **Server-enforced ownership:** hiding a button is presentation, not authorization. Requests are checked against the signed-in account, including requests from administrators.
- **Different levels of testing:** database substitutes exercise HTTP and permission behaviour; browser fixtures exercise layout and interaction. Neither proves that the real MySQL deployment works, so I keep that verification separate.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript (ES modules) |
| Backend | Node.js, Express |
| Database | MySQL, mysql2 |
| Authentication | Passport.js (local strategy), bcrypt, express-session |
| Uploads | Multer with image validation |
| Testing and tooling | npm, Node's built-in test runner, headless Chrome |

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

For a fresh deployment with no old accounts or pins, follow [Fresh deployment and site ownership](DEPLOYMENT.md). It uses `database/schema.sql`, a non-destructive installer and a one-time owner bootstrap. The legacy dump instructions below are for disposable development databases only.

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
   This is required when using the legacy dump. Also apply `migrations/009_team_titles.sql` once for account titles; the fresh schema already includes both changes.
6. Run `npm start` and open `http://localhost:3000/landingpage.html`.
   In PowerShell, use `npm.cmd ci`, `npm.cmd test`, and `npm.cmd start` if
   execution policy blocks the npm PowerShell wrapper.

The active board and pin routers are mounted and database settings are read
from the environment. The unused `routes/index.js` is not mounted and imports
packages outside the current manifest; it is not part of this startup path.
External provider discovery is deferred and is not required for the core application.
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
real-database integrity still need separate integration checks. Browser fixture checks are described below.

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
through `pins.board_id`. Semi-private boards use explicit viewer grants. Boards containing originals cannot be deleted; removing a saved reference affects only that membership.

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

### Verification status

My latest local regression run passed **215 tests**. I also ran the fixture-backed Chrome checks across eleven active pages at 1440, 768 and 320 pixels, including enlarged text, form labels, nested dialogs, focus return and persisted themes. The standalone Pages demo was checked at its repository subpath for reflow, creation, saved references, comments, reload persistence, undo and reset. Theme palette tests check text contrast; they are not a complete accessibility audit.

To repeat the browser checks on Windows with Chrome installed and port 3000 free:

```powershell
node scripts/browser-ui.cjs
node scripts/browser-ui.cjs --screenshots
```

The runner serves local fixture responses at `http://localhost:3000`, uses a temporary browser profile and leaves application data untouched. The screenshot option prints a temporary output folder. Its default Chrome path is Windows-specific; `SAVVIT_CHROME` can override the executable. This runner requires a Node version with a global WebSocket implementation; my local checks used Node.js 26.13.0.

The separate `npm.cmd run test:mysql` runner creates and removes its own disposable database. It needs an account authorised to create that database; do not elevate the application account. The latest attempt was blocked by database permissions, so I do not claim a successful real-MySQL integration run. Screen-reader and deployed end-to-end checks remain outstanding.

## Current limitations

- I have not deployed a public demo or verified the complete setup against real MySQL from a fresh clone.
- Public boards still require sign-in; anonymous browsing is not implemented.
- Production session storage, durable image storage and deployment configuration remain release work. Uploaded files are currently retained after pin deletion.
- YouTube and Pixabay discovery remain deferred. Provider credentials must stay out of public JavaScript.
- Some legacy pages, styles and duplicated database access remain in the repository. The current shared design covers the active application pages.
- Browser fixture checks and palette contrast tests do not establish full WCAG conformance. Screen-reader testing remains to be done.

## Portfolio release plan

I'm keeping the current feature set stable while I prepare a reviewable demonstration.

1. **Verify persistence:** run the disposable MySQL checks with suitable test credentials, then exercise registration, boards, uploads, sharing and revocation against real MySQL.
2. **Prepare demonstration content:** use clearly labelled sample accounts and a small collection of images with confirmed usage rights. Existing development records are not a documented demo account.
3. **Capture the experience:** publish desktop/mobile screenshots and a short walkthrough of creating a board, saving a reference, managing sharing and using the keyboard. Label fixture-backed screenshots if used before database verification.
4. **Prepare hosting:** publish the standalone browser demo from `docs/` on GitHub Pages. A future live app with real accounts still needs application hosting, MySQL, persistent image storage and a production session store.
5. **Connect my portfolio:** add a Savvit project card with the repository link, screenshots, this skills summary and a live-demo link once available.

## Project background

Savvit began as a collaborative academic web application. This repository is being developed further as an independently maintained portfolio project, with a focus on improving its architecture, security, usability, and deployability. The original collaborative work remains part of the project's history.

## Interactive portfolio demo

I keep a standalone demo in [docs/index.html](docs/index.html). It includes sample boards and illustrations, board/pin creation, search, sorting, likes, comments and saving references. Changes stay in the visitor's browser; **Reset demo** restores the samples. It does not connect to MySQL or create real accounts.

Run `node scripts/preview-demo.cjs` and open `http://localhost:3000/Savvit-Web-Based-Development/`. Stop the main app first if it uses port 3000. Publishing instructions are in [DEPLOYMENT.md](DEPLOYMENT.md#github-pages-portfolio-demo). The Pages deployment has not yet been published or verified.

## Contributing and feedback

Issues and suggestions are welcome. Current work is focused on stabilising the application before expanding its feature set.
