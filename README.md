# Red Barn Nursery School Stay & Play

Low-cost scheduling and billing-preparation software for Red Barn Nursery School's Stay & Play program.

The parent booking, secure cancellation, passwordless staff-login, live staff schedule, and billing-preparation flows are implemented as static interfaces plus Vercel Functions. Supabase stores reservations, enforces capacity in database transactions, and maintains the staff whitelist, revocable sessions, school-day settings, and billing statuses. BILL.com integration comes last.

## Included views

- **Parent booking:** A shared public form where parents enter contact and child names, assign children to dates, see live capacity, and review charges.
- **Manage booking:** Parents enter their email, receive a 30-minute secure link, and cancel an individual child/date from their family calendar.
- **Staff login:** Authorized staff enter an allowlisted email and receive a short-lived one-time dashboard link.
- **Staff demo:** Enter `test@test.com` on the staff-login page to open a sample-only preview without sending email. It never reads live staff, child, family, or billing data.
- **Staff dashboard:** A session-gated live schedule with date-level rosters and a billing report with charge detail, family totals, CSV export, and persisted `Ready`, `Sent`, `Paid`, and `Waived` statuses.

## Current rules represented

- Stay & Play runs from noon to 2:00 PM.
- Each date has a maximum of 14 child-spots.
- One child costs **$50 per family per day**.
- Two or more siblings cost **$75 per family per day**.
- Parents must book or cancel by noon the day before.
- Late cancellations remain billable.

## Architecture

- Static, light-mode parent and staff interfaces use Red Barn's existing red, white, and black visual language.
- Vercel Functions in `api/` keep database and email credentials out of the browser.
- Staff operations share one routed function so the deployment stays within Vercel Hobby's 12-function limit.
- Supabase/Postgres functions lock program-day rows before booking so simultaneous submissions cannot exceed 14 children.
- Row Level Security is enabled on every app table. Browser roles cannot read family, child, booking, or billing tables.
- Secure management tokens are random, stored only as SHA-256 hashes, expire after 30 minutes, and are carried in the URL fragment so they are not included in HTTP requests or normal server logs.
- Staff login links follow the same fragment/hash pattern. Successful redemption creates a seven-day, server-revocable session stored in a secure HttpOnly cookie; every staff-data API validates it, and school-day settings additionally require the `admin` role.

## Run locally

Use Node 22 or later.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the server-side values.
3. Run `npm run build:pages` after editing a fragment in `src/`.
4. Run `npx vercel dev` from the project directory.
5. Open the local URL shown by Vercel.

Do not commit `.env.local` or any Supabase secret key. `SUPABASE_SECRET_KEY` must remain a server-only Vercel environment variable.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | API URL for the dedicated Stay & Play Supabase project |
| `SUPABASE_SECRET_KEY` | Server-only key used by the Vercel Functions |
| `RESEND_API_KEY` | Transactional email API key |
| `STAY_PLAY_FROM_EMAIL` | Verified sender shown on confirmation and management emails |
| `RESEND_EMAIL_DOMAIN` | Optional verified domain used as `stay-and-play@<domain>` when no full sender is set |
| `PUBLIC_APP_URL` | Canonical Vercel production URL used in email links |

The deployed app can show static pages before these variables are configured, but live availability, booking, secure links, and cancellation require the Supabase values. Email additionally requires the three email settings.

## Supabase setup

The full, repeatable database definition is in `supabase/schema.sql`. It creates the sessions, program days, families, children, bookings, booking items, secure-link records, billing tables, staff whitelist/login/session tables, staff-facing billing views, and server-only RPC functions.

Current configured dates:

- Session 1: September 14–December 18, 2026; booking opens August 24, 2026.
- Session 2: January 4–June 10, 2027; booking opens December 26, 2026.

Administrators can mark an unbooked program day closed or reopen it from the staff schedule. The exact school closure dates still need to come from the school calendar and must not be guessed.

## Verification

Run `npm run check` to validate generated pages and syntax, `npm test` for unit/API-helper tests, and `npm run test:browser` for the Playwright UI suite. GitHub Actions runs all three checks on pushes and pull requests.

## Project status

- Supabase schema: installed in the dedicated RBNS free-tier project.
- Parent booking and secure cancellation: implemented against live Supabase; real email delivery still needs a verified sender domain.
- Staff authentication: implemented with an email whitelist, one-time links, HttpOnly sessions, and a dashboard gate; the first administrator email still needs to be supplied and added.
- Staff schedule and billing: implemented with protected live queries, rosters, row/family reports, persisted statuses, CSV export, and admin-only day closures.
- BILL.com: intentionally deferred until the scheduling workflow is approved.

The editable parent and staff fragments are in `src/`. `npm run build:pages` creates the standalone deployable root pages and `npm run check` rejects source/root drift.

The durable staff-auth design and acceptance criteria are in `docs/STAFF_AUTH_PLAN.md`.
