# Fresh deployment and site ownership

## GitHub Pages portfolio demo

The standalone interactive demo is in `docs/`. It runs entirely in the browser, with three sample boards, six CSS illustrations and local changes saved under `savvit-portfolio-demo-v1`. It needs no database, credentials, dependencies or external image services. It supports board/pin creation, search, sorting, likes, comments, saved references, undoing the latest removal and resetting the samples. These are local demonstrations, not real accounts or sharing permissions. Browser storage can be cleared or unavailable; the demo explains when changes cannot be persisted.

For a local preview, stop anything using port 3000 and run:

```powershell
node scripts/preview-demo.cjs
```

Open `http://localhost:3000/Savvit-Web-Based-Development/`. The preview serves only `docs/`, never application configuration or development uploads.

After I review and manually commit/push the changes, I can select **Settings → Pages → Deploy from a branch**, choose my published branch and **/docs**, then save. No repository settings or deployment workflows have been changed here. The expected project address is `https://brandonho419.github.io/Savvit-Web-Based-Development/`; I should use GitHub's confirmed address when updating the portfolio.

Before sharing the link, I check it in a private window: open a sample pin, create a board, save a reference, reload to check persistence, then reset. I also check keyboard navigation and the mobile layout. The automated browser runner exercises the demo at its repository subpath, plus the existing application fixtures. Publishing and screen-reader checks still need manual verification.

The rest of this guide applies to a future live deployment with real accounts and MySQL.

I keep my portfolio and Savvit's live application separate. GitHub Pages can serve the portfolio, but Savvit needs a Node.js server, MySQL and persistent image storage. Changing the SQL database would not make Express run on Pages.

## Hosting layout

```text
Portfolio on GitHub Pages
          |
          +-- link to Savvit's HTTPS address
                        |
                   Express app
                    /       \
               MySQL      upload storage
```

I serve the app's HTML and API from the same origin so its current session cookies and CSRF flow stay together. I do not publish the application server, database dump or credentials as a Pages site.

No hosting account, paid resources or live deployment have been created by these changes.

## Free and low-cost hosting options

I checked these options on **12 November 2026**. Prices are in USD, before any applicable taxes. Free allowances and availability can change; no provider has been selected yet.

| Option | Monthly cost | Fit for Savvit |
| --- | --- | --- |
| Oracle Cloud Always Free VM | $0 within the Always Free allowances | I can run Express and MySQL on a Linux server with persistent storage for uploads. This keeps the current database engine, but I would manage server updates, HTTPS and backups. Capacity is limited and idle instances may be reclaimed. |
| Railway Hobby | $5 minimum, including $5 of resource usage; additional usage costs extra | Express, a MySQL service and persistent upload storage can live in one project. This is the simpler deployment option for the existing app. The final bill depends on both services and storage, so $5 is not a fixed all-inclusive quote. |
| Render Free + Supabase Free | $0 within both providers' allowances | Render can run Express; Supabase supplies PostgreSQL and file storage. This would require a deliberate MySQL-to-PostgreSQL migration and changes to upload storage. Render sleeps when idle, and Supabase can pause inactive projects. |

Oracle requires a payment card for identity verification. Its Always Free resources are separate from the temporary trial credits. I would check availability before preparing a deployment around it. See [Oracle's Free Tier FAQ](https://www.oracle.com/cloud/free/faq/) and [Always Free resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Railway also offers a Free plan with $1 of monthly resource credit. I have not measured Savvit's hosted resource use, so I would not assume that covers a continuously running app and MySQL. See [Railway pricing](https://docs.railway.com/pricing/plans), [MySQL services](https://docs.railway.com/databases/mysql) and [persistent volumes](https://docs.railway.com/volumes/reference).

Render's free web service sleeps after 15 minutes without traffic and can take about a minute to wake. Its local files are lost on restarts, redeploys and sleep, so the current upload directory cannot safely hold live images there. Supabase Free includes a 500 MB PostgreSQL database and 1 GB of file storage, with inactivity pausing after one week. A storage integration would need to preserve Savvit's private-board checks. See [Render's free service limits](https://render.com/docs/free) and [Supabase pricing](https://supabase.com/pricing).

Aiven's free MySQL tier is now retired for new services, despite older guides still recommending it. Its MySQL Developer plan starts at $5/month for the database alone. See [Aiven's retirement notice](https://aiven.io/free-mysql-database-retired).

For a strict $0 budget, my first step would be checking Oracle Always Free availability while keeping MySQL. If a small monthly bill is acceptable, Railway avoids maintaining a whole server. I would choose a database migration only after deciding its ongoing free-hosting tradeoffs are worthwhile. None of these options makes Express run on GitHub Pages; my portfolio would still link to the separately hosted app.

## Start with an empty database

1. Provision a **new, dedicated MySQL 8 database** through the chosen host. Keep the application stopped while setting it up. Do not select the existing development database.
2. Supply the new server's `DB_HOST`, `DB_PORT`, `DB_USER` and `DB_PASSWORD` using the host's secure configuration. The setup command takes the database name explicitly. It does not silently adopt `DB_NAME`.
3. From the repository, run:

   ```powershell
   node scripts/init-fresh-db.cjs schema savvit_live
   ```

   Replace `savvit_live` with the name actually provisioned. This installs [database/schema.sql](database/schema.sql), including viewer grants and team titles, with **zero users, pins, boards, comments or other seeded records**. Do not import the legacy `database.sql` dump or apply migrations on top of the fresh schema.

The installer checks for existing tables and refuses a non-empty database. It never drops tables or databases. MySQL schema statements commit individually: if setup fails partway through, inspect that new database rather than rerunning blindly. The installer will refuse the partial installation on the next run.

Use setup credentials with permission to create tables only for installation; the running application should not need database-creation privileges. Use a newly provisioned empty upload volume at the current application's `public/uploads` path. Do not copy development uploads into it.

## Create my owner account

Before starting the app or allowing registrations, supply these **one-time server-side variables**:

| Variable | Purpose |
| --- | --- |
| `SAVVIT_OWNER_USERNAME` | My chosen username |
| `SAVVIT_OWNER_EMAIL` | The email I will use to sign in |
| `SAVVIT_OWNER_PASSWORD` | My private password, never committed or shared in chat |

Then run:

```powershell
node scripts/init-fresh-db.cjs owner savvit_live
```

This creates only my owner account, hashes its password with bcrypt, and refuses to run if **any account already exists**. The clean installation initially has zero accounts; after this deliberate bootstrap it has one owner and no content. Ordinary registrations never receive owner/admin access, even if they submit forged role or title fields.

Remove the one-time owner variables from the host configuration after setup. Set the application's `DB_NAME` to the new database and provide a fresh private `SESSION_SECRET`. There is no hardcoded owner password, public owner-claim URL or client-side privilege switch.

## Roles and team titles

| Access role | Account-management permissions |
| --- | --- |
| Owner | View account details and aggregate site statistics, create regular accounts, assign/revoke admin roles, assign/remove team titles, and delete eligible non-owner accounts |
| Admin | View account details and aggregate site statistics, create regular accounts, and delete eligible regular accounts |
| User | Use boards, pins and interactions according to existing content-access rules |

The following optional titles are independent of access roles:

- Original Team Member
- Co-developer
- Co-founder

Only the owner can assign them. Titles appear in the account's profile and the administrative user table. They do not grant access to private content or administrative endpoints.

I can open **Profile → Site management**, create an account if necessary, then use its ID from the users table to set its role and title. New accounts always start as users. The owner account cannot be assigned, demoted or deleted through these web controls; admins cannot delete other admins. Existing foreign-key relationships may prevent deletion of accounts that own content.

Owner/admin authority does **not** override private boards, original-pin ownership or explicit viewer grants. Statistics expose aggregate counts; account listings exclude password hashes and session tokens. Roles are loaded from the database on subsequent authenticated requests, so a demoted admin loses access without needing to sign out first.

## Existing local databases

I can leave my current database and content untouched. If I want to use team titles on that existing installation, I must take a backup and apply [migrations/009_team_titles.sql](migrations/009_team_titles.sql) **once**. This adds a nullable title column. It does not promote an existing account to owner. The bootstrap command is deliberately limited to the fresh deployment.

The fresh schema and migration file are prepared in the repository; no existing database has been migrated by this work.

## Before publishing the live app

The host choice determines the remaining configuration. These items are still required before calling the deployment ready:

- Configure HTTPS and the correct trusted reverse proxy, so production secure session cookies work behind the chosen host.
- Replace the default in-memory session store with an appropriate production store. This requires a separate implementation/dependency decision.
- Configure the host's required MySQL TLS settings, least-privilege application credentials and backups.
- Mount persistent upload storage and verify that protected upload URLs still enforce board access.
- Run the real-MySQL checks, then verify registration, owner/admin boundaries, uploads, saved references and sharing on the actual deployment.
- Add the resulting HTTPS application URL to the portfolio's Savvit card.

## Verification commands

```powershell
npm.cmd test
npm.cmd run test:mysql
node scripts/browser-ui.cjs
```

The normal tests use database substitutes. The browser runner uses fixtures at `http://localhost:3000` and needs that port free. Neither writes to application data.

The MySQL runner creates and drops its own randomly named disposable database. It now checks the empty schema, refusal of existing tables and one-time owner bootstrap before exercising the existing data workflows. It requires test credentials with database-creation permission; the latest local attempt was blocked with `ER_DBACCESS_DENIED_ERROR`. I do not treat the unit/browser tests as proof of a successful real database deployment.
