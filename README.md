# Red Barn Nursery School Stay & Play

Low-cost scheduling and billing-preparation software for Red Barn Nursery School's Stay & Play program.

The parent booking and secure cancellation flows are implemented as a static interface plus Vercel Functions. Supabase stores reservations and enforces capacity in database transactions. The staff dashboard is currently an interactive design preview; BILL.com integration comes last.

## Included views

- **Parent booking:** A shared public form where parents enter contact and child names, assign children to dates, see live capacity, and review charges.
- **Manage booking:** Parents enter their email, receive a 30-minute secure link, and cancel an individual child/date from their family calendar.
- **Staff dashboard preview:** A schedule with date-level rosters and a billing report with charge detail, family totals, and `Ready`, `Sent`, `Paid`, and `Waived` statuses.

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
- Supabase/Postgres functions lock program-day rows before booking so simultaneous submissions cannot exceed 14 children.
- Row Level Security is enabled on every app table. Browser roles cannot read family, child, booking, or billing tables.
- Secure management tokens are random, stored only as SHA-256 hashes, expire after 30 minutes, and are carried in the URL fragment so they are not included in HTTP requests or normal server logs.

## Run locally

Use Node 22 or later. No package install or build step is required.

1. Copy `.env.example` to `.env.local` and fill in the server-side values.
2. Run `npx vercel dev` from the project directory.
3. Open the local URL shown by Vercel.

Do not commit `.env.local` or any Supabase secret key. `SUPABASE_SECRET_KEY` must remain a server-only Vercel environment variable.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | API URL for the dedicated Stay & Play Supabase project |
| `SUPABASE_SECRET_KEY` | Server-only key used by the Vercel Functions |
| `RESEND_API_KEY` | Transactional email API key |
| `STAY_PLAY_FROM_EMAIL` | Verified sender shown on confirmation and management emails |
| `PUBLIC_APP_URL` | Canonical Vercel production URL used in email links |

The deployed app can show static pages before these variables are configured, but live availability, booking, secure links, and cancellation require the Supabase values. Email additionally requires the three email settings.

## Supabase setup

The full, repeatable database definition is in `supabase/schema.sql`. It creates the sessions, program days, families, children, bookings, booking items, secure-link records, billing tables, staff-facing billing views, and the five server-only RPC functions.

Current configured dates:

- Session 1: September 14–December 18, 2026; booking opens August 24, 2026.
- Session 2: January 4–June 10, 2027; booking opens December 26, 2026.

School-closed dates can be disabled in `stay_play_program_days` by setting `booking_enabled` to `false` and adding a `closure_note`.

## Verification

Run `npm run check` to syntax-check every server function and `npm test` to run the Node test suite.

## Project status

- Supabase schema: installed in the dedicated RBNS free-tier project.
- Parent booking and secure cancellation: implemented; production Supabase connection is active, while email still needs its Resend settings.
- Staff dashboard: interactive preview with illustrative data; live staff auth and queries are next.
- BILL.com: intentionally deferred until the scheduling workflow is approved.

The editable parent and staff fragments are in `src/`. Root HTML files are standalone deployable pages.
