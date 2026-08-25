# Staff Login and Authorization Plan

This document is the durable implementation plan for protecting the Red Barn Stay & Play staff dashboard.

## Implementation status — August 25, 2026

- The login page, authentication endpoints, email template, shared session helper, dashboard gate, sign-out action, response headers, and automated tests are deployed.
- Supabase migration `20260825045423_staff_auth` is applied to the RBNS project and recorded in Supabase migration history.
- The three staff-auth tables are empty. No staff or administrator email has been guessed or seeded.
- Database verification confirms RLS is enabled, `anon` and `authenticated` have no table or function access, and `service_role` has the required access.
- Syntax, unit, Playwright, production unauthenticated redirect, responsive layout, and basic accessibility checks pass.
- The staff routes are consolidated behind one Vercel Function to remain within the Hobby plan’s 12-function limit.
- The full emailed-link end-to-end test remains pending until the first authorized staff email and verified Resend sender domain are supplied.

## Goal

Staff members enter their email address on a dedicated login page. If the normalized email is active in the Supabase staff whitelist, the system emails a short-lived, one-time link to the staff dashboard. Parents remain completely separate and do not receive accounts.

The staff dashboard must never rely on hiding browser controls as its security boundary. Every future endpoint that returns child, family, roster, billing, or staff-administration data must validate the staff session on the server before returning data.

## User flow

1. Staff opens `/staff-login.html`.
2. Staff enters their email address.
3. The browser sends the email to `POST /api/staff/request-link`.
4. The server normalizes the email and checks the private Supabase staff whitelist.
5. The response is always the same generic message, whether the email is missing, invalid, unauthorized, inactive, or authorized. This prevents people from discovering staff emails.
6. If the email belongs to an active staff member and is not rate-limited, the server creates a random 256-bit token, stores only its SHA-256 hash, and emails a link like:

   `https://<app>/staff.html#staff-token=<random-token>`

7. The raw token is placed after `#`, so it is not sent in the initial HTTP request, normal Vercel request logs, or ordinary referrer headers.
8. The staff page removes the token from browser history and sends it to `POST /api/staff/redeem`.
9. The server atomically marks the one-time link as used, creates a staff session, stores only the session-token hash in Supabase, and sets the raw session token in a secure HttpOnly cookie.
10. The dashboard is shown only after `GET /api/staff/session` confirms that:

    - the session exists;
    - the session has not expired or been revoked;
    - the related staff member is still active.

11. Signing out calls `POST /api/staff/logout`, revokes the server-side session, and clears the cookie.

## Database design

All tables live in the dedicated RBNS Supabase project only:

- Project ID: `jmewsaaexmvnozcjuxdh`
- Never access or modify Sentinel: `qmgruixpgmunrzbsodfq`

### `stay_play_staff_members`

One row per authorized staff email.

| Column | Purpose |
| --- | --- |
| `id` | Internal bigint identity primary key |
| `email` | Case-insensitive unique email address |
| `display_name` | Optional staff name shown in the dashboard |
| `role` | `staff` or `admin` |
| `active` | Immediate allow/deny switch |
| `created_at` | Audit timestamp |
| `updated_at` | Audit timestamp |

The first administrator can be added manually through the Supabase Table Editor. A protected staff-access UI can be added later for administrators to add, deactivate, or change staff roles.

### `stay_play_staff_login_links`

Short-lived, one-time email links.

| Column | Purpose |
| --- | --- |
| `id` | Internal bigint identity primary key |
| `staff_member_id` | Authorized staff member receiving the link |
| `token_hash` | SHA-256 hash of the random link token; plaintext is never stored |
| `expires_at` | Link expiration, initially 20 minutes |
| `used_at` | Set when the link is redeemed |
| `revoked_at` | Set when superseded or manually revoked |
| `created_at` | Audit timestamp |

Only one active link should remain for a staff member. Issuing a new link revokes earlier unused links. Requests are rate-limited per staff member.

### `stay_play_staff_sessions`

Server-verifiable dashboard sessions.

| Column | Purpose |
| --- | --- |
| `id` | Internal bigint identity primary key |
| `staff_member_id` | Signed-in staff member |
| `token_hash` | SHA-256 hash of the random session token |
| `expires_at` | Session expiration, initially seven days |
| `last_seen_at` | Last successful validation time |
| `revoked_at` | Set on logout or administrative revocation |
| `created_at` | Audit timestamp |

Deactivating a staff member blocks the next API request even if an old cookie still exists. Administrative removal should also revoke all of that staff member's sessions.

## Database access rules

- Enable Row Level Security on all three staff-auth tables.
- Grant no access to `anon` or `authenticated` browser roles.
- Grant access only to the Vercel server's Supabase secret/service role.
- The Supabase secret key must never be included in HTML or browser JavaScript.
- Server-only database functions must be explicitly revoked from `PUBLIC`, `anon`, and `authenticated` and granted only to `service_role`.
- Any `SECURITY DEFINER` function must set an empty `search_path`, fully qualify all objects, validate all inputs, and be callable only by `service_role`.

Implemented server-only database functions:

- `issue_stay_play_staff_link(email, link_hash, expires_at)`
- `redeem_stay_play_staff_link(link_hash, session_hash, session_expires_at)`
- `get_stay_play_staff_session(session_hash)`
- `revoke_stay_play_staff_session(session_hash)`

## Vercel API endpoints

### `POST /api/staff/request-link`

Input:

```json
{ "email": "staff@example.org" }
```

Behavior:

- Normalize and length-check the email.
- Generate a random link token and hash it on the server.
- Ask Supabase to issue the link only for an active whitelisted email.
- Send the staff-login email through the existing Resend integration.
- Always return HTTP 200 with the same generic message to prevent account enumeration.
- Log provider/database failures without exposing internal details to the browser.

Generic response:

```json
{
  "message": "If that email is authorized for staff access, a secure link is on its way."
}
```

### `POST /api/staff/redeem`

Input:

```json
{ "token": "raw-token-from-url-fragment" }
```

Behavior:

- Validate token format and length.
- Hash the link token.
- Generate and hash a new random session token.
- Atomically redeem the unused, unexpired link and create the session.
- Set the raw session token in an HttpOnly cookie.
- Return only the staff display name and role.

Cookie settings:

- Name: `rb_staff_session`
- `HttpOnly`
- `Secure` in production
- `SameSite=Lax`
- `Path=/`
- `Max-Age` matching the server-side session expiration

### `GET /api/staff/session`

Behavior:

- Read the HttpOnly cookie.
- Hash it and validate the session through Supabase.
- Confirm the staff member remains active.
- Return `{ authenticated: true, staff: { displayName, role } }` when valid.
- Return HTTP 401 and clear the cookie when invalid, expired, revoked, or inactive.

### `POST /api/staff/logout`

Behavior:

- Hash the current cookie token and revoke the matching session.
- Clear the cookie even if server-side revocation fails.
- Return a generic success response.

### Future `/api/staff/*` endpoints

Every staff schedule, roster, billing, CSV, status-update, and whitelist-administration endpoint must call one shared `requireStaffSession` helper before reading or changing data. Administrative operations must additionally require `role = 'admin'`.

## Pages

### `/staff-login.html`

- Light-mode Red Barn design language.
- One email field and `Email me a secure link` button.
- Clear explanation that access is limited to authorized school staff.
- Generic success copy regardless of whether the address is authorized.
- No child, family, schedule, or billing data.

### `/staff.html`

- Hide the dashboard until the session check succeeds.
- If the URL contains `#staff-token=...`, remove the fragment immediately and redeem it.
- If session validation fails, redirect to `/staff-login.html`.
- Add a visible Sign out action.
- Add `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY` headers.
- Current static roster/billing preview data must not be treated as protected production data. Before live staff APIs are connected, the dashboard source must contain no real child or family information.

## Email

Add `sendStaffLoginEmail` to the existing email helper.

The email includes:

- Red Barn styling;
- recipient's optional display name;
- `Open staff dashboard` button;
- link expiration;
- warning to ignore the email if it was not requested.

Email delivery uses the existing Resend configuration and verified sender when available. A provider failure must not cause a different browser response for known versus unknown staff emails.

## Security decisions

- The whitelist is authorization; possession of the email link proves access to that mailbox.
- No password database is created.
- Raw link and session tokens are never stored in Supabase.
- Email links are one-time use and short-lived.
- Sessions are server-revocable and re-check the staff member's active flag on every protected request.
- The session cookie is unavailable to browser JavaScript.
- URLs and normal logs do not contain session tokens.
- Login responses do not reveal whether an email is on the whitelist.
- Real staff data will be returned only by session-protected APIs, never embedded into a public static HTML file.
- Logout, staff deactivation, and session expiration all fail closed.

## Implementation sequence

1. Add the three staff-auth tables, indexes, RLS configuration, and server-only functions to `supabase/schema.sql` and a generated migration file.
2. Apply the migration only to Supabase project `jmewsaaexmvnozcjuxdh`.
3. Add shared token, cookie, and `requireStaffSession` helpers.
4. Add staff email template.
5. Add the four staff-auth API endpoints.
6. Build `/staff-login.html`.
7. Add the session gate and Sign out action to `/staff.html` without overwriting unrelated local UI changes.
8. Update `vercel.json`, `.env.example`, README, and the QA plan.
9. Add the first admin email manually after the user supplies it.
10. Run syntax, API, database, security-advisor, browser, responsive, enumeration, token-reuse, expiry, logout, and deactivation tests.
11. Deploy through the existing GitHub-to-Vercel workflow only after review.

The migration was generated with the pinned Supabase CLI, applied through approved Supabase tooling, and verified in Supabase migration history.

## Acceptance tests

### Login request

- Authorized active email receives a link attempt.
- Unauthorized, inactive, invalid, and authorized emails receive identical browser responses.
- Repeated requests inside the rate limit do not send multiple links.
- Email-provider failure does not reveal whitelist membership.

### Link redemption

- A valid unused link creates a session and opens the dashboard.
- A used link cannot be redeemed again.
- An expired, revoked, malformed, or unknown link fails generically.
- The raw link token is absent from Supabase and normal HTTP request logs.

### Session protection

- Visiting `/staff.html` without a session redirects to login and never renders the dashboard.
- A valid session displays the dashboard.
- An expired or revoked session is rejected.
- Deactivating a staff member invalidates access on the next protected request.
- Logout revokes the session and clears the cookie.
- Staff APIs reject missing, malformed, expired, revoked, and inactive sessions.
- Admin-only endpoints reject ordinary staff sessions.

### Browser and accessibility

- Login works by keyboard and has visible focus indicators.
- Success and error copy is announced through a live region.
- Login and session checks work at 1440×900, 1024×768, 390×844, and 320×568.
- No dark mode or black outer frame appears.
- Back/refresh after redemption does not expose or reuse the raw email-link token.

### Database and security

- RLS is enabled on all new tables.
- `anon` and `authenticated` cannot read or write the tables or call the functions.
- Only the service role can call staff-auth functions.
- Supabase security advisors report no new warning/error findings.
- The implementation never accesses the Sentinel project.

## Decisions still needed

- The first administrator's email address and optional display name.
- Whether the session lifetime should remain seven days or be shorter.
- Whether staff access management is initially performed only in Supabase or gets an admin UI in the first release.
