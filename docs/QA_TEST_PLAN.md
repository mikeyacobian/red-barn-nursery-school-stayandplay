# Stay & Play QA Test Plan and Bug Register

This file is the durable source of truth for the UI bug bash and functional verification of the hosted Stay & Play app.

## Test protocol

- Production URL: `https://red-barn-nursery-school-stayandplay.vercel.app/`
- Supabase project: `jmewsaaexmvnozcjuxdh` (`Stay & Play Booking` in the RBNS organization)
- Never access or modify the Sentinel project.
- Use synthetic families whose email contains `stay-play-qa`.
- Record the database state before and after each data-changing test.
- Remove only the precisely identified synthetic QA records after the run.
- During the bug bash, log bugs without fixing them. Review and prioritize the complete register before making a fix plan.

Status values: `Not run`, `Pass`, `Fail`, `Blocked`, `Not implemented`.

Severity values:

- `P0`: Data loss, privacy/security exposure, or the core service is unusable.
- `P1`: Core booking/cancellation/capacity behavior is broken with no practical workaround.
- `P2`: Important workflow or responsive/accessibility defect with a workaround.
- `P3`: Cosmetic, copy, or low-impact usability defect.

## Environment baseline

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| ENV-01 | Production parent page loads | Page loads without a fatal browser error | Pass | Initial DOM loaded on 2026-08-24. |
| ENV-02 | Live availability API responds | HTTP 200 with configured program days | Pass | Previously verified: 184 program days. |
| ENV-03 | Parent page consumes live availability | UI says `Live availability` and matches database counts | Fail | Reconfirmed 2026-08-25: production says `Preview availability` and shows demo counts (for example, Sep 14 has 9 open and Sep 15 is full), while the live API returns 0 booked / 14 open and Supabase has zero transactional rows. See BUG-001. |
| ENV-04 | Database starts clean | No families, children, bookings, booking items, manage links, billing rows, or email rows | Pass | Supabase read-only count audit on 2026-08-24 returned zero for every transactional table. |
| ENV-05 | Browser console and network baseline | No unexpected errors; API requests succeed | Fail | Reconfirmed 2026-08-25: the parent iframe never consumes `/api/availability`, even though the endpoint independently returns HTTP 200 with 184 days. The page itself produced no new console warnings/errors during the read-only smoke run. |
| ENV-06 | Email configuration baseline | Resend integration is present; sender-domain limitation is documented | Pass | Integration present. Placeholder domain is not yet DNS verified, so real parent delivery remains blocked. |

## Parent booking — UI and interaction

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| PUI-01 | Header/navigation relevance | Only working, relevant actions are shown | Fail | Programs, About Us, and Admissions go nowhere and are unnecessary. See BUG-004. |
| PUI-02 | Manage booking entry point | Top/header Manage booking action is visible and opens `/manage.html` | Fail | User reports the top link does not navigate. See BUG-003. |
| PUI-03 | Live capacity display | Each open date shows 14 anonymous capacity circles and the correct open count | Fail | The accessible circle counts render, but they are demo values rather than live capacity; Sep 14 announces 5 booked / 9 open while the API and database say 0 booked / 14 open. See BUG-001. |
| PUI-04 | No demo reservations | A clean database produces zero booked circles on all open dates | Fail | Hard-coded fallback currently displays booked dates. See BUG-001. |
| PUI-05 | Month selector — next | Next month changes the label and grid once | Fail | Automated click left the label and September grid unchanged. See BUG-002. |
| PUI-06 | Month selector — previous | Previous month returns to the prior label and grid once | Blocked | Cannot reach another month because next-month navigation never advances. See BUG-002. |
| PUI-07 | Month boundaries | Previous/next buttons disable only at the first/last available month | Fail | Next is enabled even though the fallback state contains only September and clicking it is a no-op. See BUG-002. |
| PUI-08 | Required parent name | Missing parent name blocks review with clear guidance | Pass | Review remains disabled until a nonblank parent name is present. |
| PUI-09 | Required valid email | Missing or malformed email blocks review with clear guidance | Pass | Review remains disabled until native email validity passes; API also rejects malformed email with HTTP 400. |
| PUI-10 | Add child | `+ Add another child` adds a named child input and unique color | Fail | Second input and unique marker are added, but the visible Children count stays at 1 after the second name is entered. See BUG-005. |
| PUI-11 | Remove child | Removing a child removes their assignments and updates totals | Pass | Removing Ava also removed both of Ava’s date assignments and returned the summary to zero. |
| PUI-12 | Child limit | UI and API enforce the intended maximum children per submission | Pass | Add-child disables at six; a seven-child API request returned HTTP 400. The stale badge is tracked separately in BUG-005. |
| PUI-13 | Dynamic child chips | Chips are generated from entered child names | Pass | `Ava QA` and `Leo QA` produced Everyone (2), Ava, and Leo controls. |
| PUI-14 | Child color consistency | Each child retains one color across input, chip, date badge, and review | Pass | Distinct red/blue markers and initials remained consistent during shared and individual selection. |
| PUI-15 | Everyone assignment | Selecting a date for Everyone assigns all named children | Pass | Sep 14 showed Ava + Leo and 2 child-spots after one click. |
| PUI-16 | Individual assignment | A single child can be added to or removed from a date independently | Pass | Ava added to Sep 18; Leo removed from Sep 14 without changing Ava’s dates. |
| PUI-17 | Mixed date assignments | Multiple children can have different date sets without losing selections | Pass | Mixed assignment produced Sep 14 Ava and Sep 18 Ava after independently removing Leo. |
| PUI-18 | Full/unavailable dates | Full, closed, not-yet-open, and cutoff dates cannot be selected | Pass | Hosted DOM disables Full, School closed, and Session not open cells; Session 2 API booking is rejected. The displayed states are demo data because of BUG-001. |
| PUI-19 | Low-capacity copy | One to three remaining spots use unambiguous copy (`Only 1 left`, etc.) | Pass | Hosted grid displays `Only 1 left`, `Only 2 left`, and `Only 3 left`. |
| PUI-20 | Price summary — one child | One child on one date is shown as `$50` | Pass | Review showed `$50` for each single-child family-day. |
| PUI-21 | Price summary — siblings | Two or more siblings on one date are shown as `$75` total | Pass | Shared Sep 14 selection showed 2 child-spots and `$75`. |
| PUI-22 | Price summary — multiple dates | Total equals the sum of each family-day rate | Pass | Two single-child dates produced `$100`. |
| PUI-23 | Review modal | Review lists parent, children by date, rates, and total accurately | Pass | Review listed both dates, Ava QA, `$50` per date, and `$100` total. |
| PUI-24 | Modal dismissal | Close button, backdrop, and Escape behave safely; focus returns | Fail | Reconfirmed 2026-08-25: Escape leaves the dialog open. The explicit close button and backdrop both dismiss it, and focus returns to `Review booking`. See BUG-006. |
| PUI-25 | Duplicate submission guard | Confirm cannot be double-clicked into duplicate bookings | Pass | Confirm disables immediately and changes to `Checking availability…` before awaiting the API. |
| PUI-26 | Booking success state | Confirmation code and email-delivery status are clear | Blocked | Hosted UI cannot reach the API because of BUG-001; direct API success response was verified. |
| PUI-27 | Booking conflict state | Capacity or duplicate conflict preserves inputs and explains next action | Blocked | Hosted UI cannot reach the API because of BUG-001; direct API conflict responses were verified. |
| PUI-28 | API outage state | No fake capacity is shown; dates are disabled with retry guidance | Fail | Hosted outage state shows fake selectable capacity. Local code was changed during baseline discovery but is not deployed. See BUG-001. |

## Parent booking — responsive, visual, accessibility

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| PVA-01 | Desktop layout | 1440×900 has no clipping, overlap, or unnecessary page-within-page scroll | Fail | Hosted parent and staff UIs are full applications embedded in fixed-height iframes, creating a page-within-page scrolling/navigation boundary. See BUG-010. |
| PVA-02 | Laptop layout | 1024×768 remains usable without horizontal overflow | Fail | 1024×768 has no horizontal overflow, but the parent app still creates an inner iframe scroll (`1072px` content inside a `736px` frame). See BUG-010. |
| PVA-03 | Mobile layout | 390×844 stacks logically and has no horizontal overflow | Pass | Rechecked 2026-08-25 with an explicit 390×844 viewport: parent, manage, and staff all stack without horizontal overflow. The black outer frame is tracked separately in BUG-015. |
| PVA-04 | Small mobile layout | 320×568 remains operable and readable | Pass | Rechecked 2026-08-25: parent, manage, and staff document widths equal their viewport/frame widths at 320px, with no horizontal overflow. |
| PVA-05 | Zoom/reflow | 200% zoom preserves controls and content | Not run | |
| PVA-06 | Keyboard path | All controls are reachable and operable in a logical order | Fail | Parent controls are reachable in a logical Tab order, but keyboard-reachable controls still include the no-op Programs/About/Admissions links, broken Manage booking navigation, and broken next-month button. See BUG-002–BUG-004. |
| PVA-07 | Focus visibility | Every interactive element has a visible focus indicator | Not run | Parent subcase passed: links, fields, add-child, month, child, and date controls all exposed a visible browser outline. Manage/staff focus traversal remains pending. |
| PVA-08 | Accessible names/state | Buttons, date availability, selected children, errors, and modal have useful semantics | Pass | Accessibility snapshots expose named fields/buttons, pressed state, availability counts, scheduled child names, live regions, and an aria-modal dialog. |
| PVA-09 | Color independence | Child/date state is understandable without color alone | Pass | Date badges include initials and accessible scheduled-child names; summary/review spell out names and dates. |
| PVA-10 | Contrast/light mode | Text and controls meet practical contrast expectations; no dark mode appears | Fail | System dark preference produces a black outer frame around the white iframe app. See BUG-015. |

## Booking API and database invariants

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| API-01 | Availability shape | API returns session, date, cutoff, closure, booking, and capacity fields | Pass | HTTP 200 returned 184 days with all expected fields and daylight-saving-aware deadlines. |
| API-02 | Single-child booking | Valid request creates one family/booking/child/item and charges `$50` | Pass | Booking 1 reserved one child-spot; API and billing view both returned 5000 cents. |
| API-03 | Sibling booking | Two children on one date consume two slots and charge `$75` | Pass | Covered with the stricter three-sibling test; the family-day rate was 7500 cents. |
| API-04 | Three-plus sibling rate | Three or four children on one date still charge `$75` | Pass | Three siblings on Sep 15 consumed three spots and produced one 7500-cent family-day billing row. |
| API-05 | Multiple dates | One submission creates correct items and family-day charges across dates | Pass | Three siblings on Sep 15 plus one child on Sep 16 reserved four child-spots and returned 12500 cents total. |
| API-06 | Duplicate child/date | Same child cannot be booked twice for one date | Pass | Repeat of QA Sibling One on Sep 16 returned HTTP 409 and did not duplicate the item. |
| API-07 | Booking cutoff | Booking at/after noon the prior day is rejected | Not run | |
| API-08 | Session booking-open date | Session 2 dates remain unavailable until configured opening | Pass | Jan 4, 2027 attempt returned HTTP 409 `is not open for booking`. |
| API-09 | Closure | Disabled school day cannot be booked | Blocked | Session 1 currently has zero disabled days and zero closure notes, so there is no configured closure to exercise. See BUG-016. |
| API-10 | Capacity exactly 14 | Fourteen concurrent child-spots can be accepted | Pass | Fifteen simultaneous one-child requests on Sep 17 yielded fourteen HTTP 201 responses; database count is exactly 14. |
| API-11 | Overbooking race | Competing requests cannot create a fifteenth active child-spot | Pass | Fifteenth concurrent request returned HTTP 409; public availability reports 0 open. |
| API-12 | Input validation | Empty, malformed, oversized, and unexpected payloads fail safely | Pass | Empty parent name, invalid email, unknown child reference, duplicate child/date, and seven-child requests returned safe 400/409 responses. More fuzz cases can be added to automation. |
| API-13 | RLS/browser privacy | Browser roles cannot read family, child, booking, billing, or token data | Pass | Every app table has RLS enabled; anon/authenticated have no SELECT privileges or policies. All five server RPCs deny anon/authenticated and allow only service_role. |
| API-14 | Secrets | HTML, browser network responses, and logs never expose server keys or token hashes | Pass | Tracked-file scan found only environment-variable references/placeholders; no credential-shaped value is committed or returned by public APIs. |

## Secure manage/cancellation flow

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| MNG-01 | Request-link form | Valid email receives generic response without account enumeration | Fail | Known QA family receives HTTP 503 / `Email is temporarily unavailable`. See BUG-007. |
| MNG-02 | Unknown email | Response is indistinguishable from a known email | Fail | Unknown email receives HTTP 200 and generic success, distinguishable from a known family’s 503. See BUG-007. |
| MNG-03 | Email link construction | Link points to `/manage.html` and puts random token after `#` | Pass | Source constructs `/manage.html#token=…`; token is not sent in the initial HTTP request or normal referrer. |
| MNG-04 | Token storage | Only SHA-256 hash is stored, with 30-minute expiry | Pass | All 17 synthetic manage-link rows contain exactly 32 hash bytes and a 30-minute expiry interval; no plaintext token column exists. |
| MNG-05 | Valid token | Calendar loads only the matching family’s reservations | Blocked | Email provider cannot deliver the generated synthetic token, and the QA database connector correctly cannot execute the server-only issuer or write a test token. |
| MNG-06 | Invalid token | Generic invalid/expired state; no data leakage | Pass | API returned HTTP 401 `invalid_or_expired_link`; UI showed only the generic expired-link state. |
| MNG-07 | Expired token | Generic invalid/expired state; no data leakage | Blocked | Invalid-token state passed; a synthetic expired valid token cannot be issued through the current safe QA boundary. |
| MNG-08 | On-time cancellation | Item becomes cancelled, frees a slot, and is not billable | Blocked | Requires a retrievable valid synthetic token. Database function logic is present but was not counted as an execution pass. |
| MNG-09 | Late cancellation | Item becomes late-cancelled and remains billable | Blocked | Requires a valid token plus a controlled past-deadline test day/time. |
| MNG-10 | Cancel one sibling/date | Only the selected child/date is cancelled | Blocked | Requires a retrievable valid synthetic token. |
| MNG-11 | Repeat cancellation | Repeating the same cancellation is safe and does not alter totals twice | Blocked | Requires a retrievable valid synthetic token. |
| MNG-12 | Manage responsive/keyboard | Desktop/mobile and keyboard use are clear and operable | Not run | Responsive subcase now passes at both 390×844 and 320×568 with no horizontal overflow; keyboard subcase remains pending. |

## Staff schedule and billing

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| STF-01 | Staff access protection | Unauthenticated visitors cannot view rosters or family billing data | Blocked | Local implementation now gates `/staff.html` behind a server-validated HttpOnly session and redirects unauthenticated visits to `/staff-login.html`. Production verification is blocked until deployment. See BUG-008. |
| STF-02 | Live schedule | Calendar capacity matches live bookings | Not implemented | Staff page currently uses static data. |
| STF-03 | Daily roster | Clicking a day shows all booked children and family contact details | Not implemented | Staff page currently uses static data. |
| STF-04 | Empty schedule | Clean database shows zero bookings and an empty roster | Fail | Hosted staff UI shows 11/14 and named demo children while the baseline database was empty. See BUG-009. |
| STF-05 | Charge-row report | One row per family/date shows children, spots, rate number, `$` rate, and status | Not implemented | |
| STF-06 | Family-summary report | One row per family sums dates, child-spots, rate mix, and total | Not implemented | |
| STF-07 | Billing status update | Ready/Sent/Paid/Waived persists and updates included charge rows | Not implemented | Current control is presentation-only. |
| STF-08 | CSV export | Download contains the selected live report and correct totals | Not implemented | Button only changes to a ready message; no file is generated. See BUG-011. |
| STF-09 | Staff responsive/accessibility | Schedule and billing views work at desktop/mobile and by keyboard | Not run | Responsive schedule subcase now passes at both 390×844 and 320×568 with no horizontal overflow; billing and keyboard subcases remain pending. |
| STF-10 | Staff whitelist privacy | Unknown, inactive, invalid, authorized, and provider-failure requests receive the same browser response | Blocked | Endpoint implements one generic HTTP 200 response; full comparison requires a seeded staff email and deployed email provider. |
| STF-11 | Staff link storage | Only a 256-bit token hash is stored and the link expires after 20 minutes | Pass | Schema stores a 32-byte SHA-256 hash only; token generation and hashing unit test passes. |
| STF-12 | Staff link one-time use | A valid link succeeds once and rejects reuse, expiry, revocation, and malformed tokens generically | Blocked | Database function and API are implemented; end-to-end execution awaits the first staff email and deployment. |
| STF-13 | Staff session cookie | Cookie is HttpOnly, Secure in production, SameSite Lax, path-scoped, and expires with the seven-day server session | Pass | Automated cookie tests pass for production, local development, and clearing behavior. |
| STF-14 | Staff logout/deactivation | Logout revokes the session; deactivating staff blocks the next request | Blocked | Server behavior is implemented; live execution awaits a seeded staff member and deployment. |
| STF-15 | Staff database boundary | Staff tables and functions are inaccessible to browser roles | Pass | Live RBNS verification: all three tables have RLS, zero rows, no anon/authenticated SELECT, and service-role-only RPC execution. |
| STF-16 | Staff login responsive/accessibility | Login is keyboard-usable, light mode, and has no horizontal overflow at mobile widths | Pass | Local checks passed at 390×844 and 320×568; malformed email retains focus and native validity guidance. |

## Email behavior

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| EML-01 | Booking confirmation request | Successful booking triggers a confirmation email attempt | Pass | Every synthetic booking returned `emailSent: false`, demonstrating graceful provider failure after reservation creation. Source invokes Resend after a successful booking. |
| EML-02 | Confirmation content | Email has confirmation code, dates, children, rates, total, cutoff policy, and manage instructions | Fail | Template includes code, manage button, and cutoff policy, but omits booked dates, child names, per-day rates, and total. See BUG-012. |
| EML-03 | Manage-link email | Known family request triggers secure-link email attempt | Pass | Known-family request creates a hashed 30-minute link, then reaches the email provider and returns its current failure. BUG-007 tracks the response privacy issue. |
| EML-04 | Provider failure | Booking remains saved and UI accurately says email was not sent | Pass | API returned a saved confirmation code with `emailSent: false`; database rows and billing views were intact. |
| EML-05 | Verified sender | Real parent delivery works from the school’s verified domain | Blocked | Waiting for DNS/domain verification. |

## Cleanup and regression

| ID | Test | Expected result | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| CLN-01 | Identify QA rows | Every synthetic family/booking is precisely identifiable | Pass | Cleanup matched only `stay-play-qa-%@example.com`: 16 families, 18 children, 16 bookings, 19 items, and 18 manage links. |
| CLN-02 | Remove QA rows | Only synthetic QA data is deleted | Pass | Guarded transaction required exactly 16 matching QA families before deleting their dependent records. User confirmed the destructive cleanup immediately before execution. |
| CLN-03 | Clean post-state | Transactional table counts return to pre-test baseline | Pass | Independent query returned zero rows in every transactional table; public availability reports 0 booked and 14 open on Sep 14–17. |
| REG-01 | Automated checks | Syntax and Node test suite pass | Pass | `npm run check` passes and `npm test` runs 5/5 staff-auth helper tests. Broader booking/cancellation automation remains a follow-up under BUG-013. |
| REG-02 | Production smoke | Parent, manage, staff, API, and database boundary checks pass after deployment | Fail | 2026-08-25 smoke: pages and `/api/availability` load, the API returns 184 days, and the database is clean; the parent still uses preview data and the public staff page still exposes demo roster/billing content. |

## Bug register

| Bug | Severity | Area | Summary | Reproduction / evidence | Status | Related tests |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | P0 | Parent/API boundary | Hosted parent page cannot consume live availability and shows fake booked dates from fallback data. | Open `/parent.html`; badge says `Preview availability`. Sep 14 shows 9 open and Sep 15 shows Full, while Supabase has zero bookings and `/api/availability` reports 14 open. The generated page runs inside a sandboxed `srcdoc` iframe whose CSP/origin prevents the API request. | Logged; local fix started before log-only protocol | ENV-03, PUI-04, PUI-28 |
| BUG-002 | P1 | Parent calendar | Month selector is broken. | Automated click on Next month leaves `September 2026` and its grid unchanged. The fallback initializes `monthKeys` with only September, but the Next button is not disabled. Live months never load because of BUG-001. | Open | PUI-05, PUI-06, PUI-07 |
| BUG-003 | P1 | Navigation | Manage booking link at the top does not open the manage page. | Clicking the header link navigates the inner iframe to `/manage.html`; that page is denied by `X-Frame-Options: DENY`, leaving `refused to connect` while the top-level URL remains `/parent.html`. | Open | PUI-02 |
| BUG-004 | P3 | Navigation/content | Programs, About Us, and Admissions links go nowhere and are unnecessary. | Open parent header; all three links target `#`. | Open | PUI-01 |
| BUG-005 | P2 | Parent family form | Children count badge becomes stale after a child name changes. | Enter Ava, add a second child, then enter Leo. Dynamic chips correctly say Everyone (2), but the Children count remains 1 because input handling does not update the badge. | Open | PUI-10 |
| BUG-006 | P2 | Parent review dialog | Review dialog cannot be dismissed with Escape. | Open Review booking and press Escape. Dialog remains visible with Close review still focused. | Open | PUI-24 |
| BUG-007 | P1 | Manage/privacy | Secure-link endpoint reveals whether an email has active bookings when the email provider fails. | Known synthetic email returns HTTP 503 and `Email is temporarily unavailable`; unknown email returns HTTP 200 and generic success. This contradicts the page’s privacy promise and enables account enumeration. | Open | MNG-01, MNG-02 |
| BUG-008 | P0 release blocker | Staff/privacy | Staff dashboard has no authentication or authorization boundary. | Hosted `/staff.html` remains public. A local passwordless whitelist implementation now gates the page with a server-validated session; production remains unchanged until review and deployment. | Local fix implemented; deployment/e2e pending | STF-01, STF-10–STF-15 |
| BUG-009 | P1 | Staff/data integrity | Hosted staff schedule and billing report show static demo people and totals instead of live data. | Public staff page shows 11/14, named children, family emails, and `$475`; Supabase/live QA state differs. | Open; local source cleanup started before log-only protocol | STF-02–STF-07 |
| BUG-010 | P2 | Layout/architecture | Parent and staff apps are embedded in fixed-height sandboxed iframes, causing nested scroll and broken navigation/API boundaries. | Desktop page is a full app inside an iframe. This directly contributes to BUG-001 and BUG-003 and matches the earlier hard-to-scroll concern. | Open; local CSP change started before log-only protocol | PVA-01, ENV-03, PUI-02 |
| BUG-011 | P2 | Staff/export | Download CSV does not generate or download a CSV file. | Click Download CSV; only button/feedback text changes to say the report is ready. | Open | STF-08 |
| BUG-012 | P2 | Email/content | Booking confirmation email omits reservation and billing details. | Source template contains confirmation code, manage link, and cutoff policy but no dates, children, per-day rate, or total. | Open | EML-02 |
| BUG-013 | P1 | QA/automation | Repository test command previously passed while running zero tests. | The suite now runs five passing staff-auth helper tests. Booking, capacity, cancellation, email, and browser-flow automation are still missing. | Partially resolved | REG-01 |
| BUG-014 | P1 | Responsive layout | Parent, manage, and staff pages had severe horizontal overflow in the original 390px QA capture. | Not reproduced on 2026-08-25 using explicit 390×844 and 320×568 viewports: all three pages now report equal client/scroll widths and visually stack correctly. Retained for historical traceability. | Candidate resolved / verify after next deployment | PVA-03, PVA-04, MNG-12, STF-09 |
| BUG-015 | P2 | Visual/light mode | Outer parent/staff document renders a black frame in system dark mode. | Desktop and mobile screenshots show black page chrome surrounding the white app because the generated wrapper declares `color-scheme: light dark`. | Open | PVA-10 |
| BUG-016 | P1 release blocker | Program configuration | No school closure dates are configured for Session 1. | Database audit found 0 disabled Session 1 days and 0 closure notes. The API therefore accepts every weekday Sep 14–Dec 18 unless staff provides and loads the school calendar. | Open; needs school calendar input | API-09 |

## Post-compaction bug-fix handoff

This section contains the implementation context needed to resume after conversation compaction without repeating the bug bash. Treat the evidence above as the observed baseline and this section as the engineering handoff.

### Repository and deployment rules that affect multiple bugs

- The files in `src/` are editable UI fragments, but Vercel serves the root files `parent.html`, `manage.html`, and `staff.html`. There is currently no checked-in build or synchronization command that regenerates a root page from a `src/` fragment.
- A change to `src/parent-booking.html` or `src/staff-dashboard.html` does **not** change production by itself. The corresponding root page must be deliberately regenerated or, preferably, replaced with a direct-document implementation. Always compare both copies before claiming a UI fix.
- `parent.html` and `staff.html` are generated wrapper documents whose applications live inside fixed-height `srcdoc` iframes. This architecture is the shared cause of BUG-001, BUG-003, BUG-010, and BUG-015. Fixing those together by removing the wrapper is safer than accumulating iframe permissions and navigation workarounds.
- The local worktree contains pre-existing and partially implemented changes. Review the diff before editing. Do not discard unrelated changes, and do not call a local change deployed until it has been committed, pushed, and verified on the Vercel production URL.
- All database work belongs only to Supabase project `jmewsaaexmvnozcjuxdh`. Never access or modify Sentinel project `qmgruixpgmunrzbsodfq`.
- Keep prices as integer cents in APIs and the database. Format them with a dollar sign only at the UI/email boundary. The configured family-day rules are `$50` for one child and `$75` total for two or more siblings.
- Use only synthetic `stay-play-qa` families for data-changing tests. Capture exact row IDs/counts before cleanup, and never delete broad or unidentified records.
- Do not expose live child, family, roster, billing, or staff-whitelist data in static HTML. Every future staff-data endpoint must use `requireStaffSession`; administrative endpoints must also require the `admin` role. The complete auth boundary is in `docs/STAFF_AUTH_PLAN.md`.

### Recommended fix order

1. Resolve the parent wrapper cluster together: BUG-010, BUG-001, BUG-003, BUG-004, and BUG-015; then close the related calendar/UI defects BUG-002, BUG-005, and BUG-006 on the resulting direct document.
2. Fix privacy and customer communication before real use: BUG-007 and BUG-012, plus Resend sender-domain verification.
3. Deploy and complete end-to-end verification of the implemented staff boundary in BUG-008 before connecting any live staff data.
4. Build the protected live schedule/billing endpoints and rendering for BUG-009, then add real CSV export for BUG-011.
5. Load the school-supplied closure calendar for BUG-016 before Session 1 opens to parents.
6. Add automation continuously under BUG-013 and close historical BUG-014 only after the structural/responsive changes are deployed and rechecked.

### BUG-001 — Parent page uses preview capacity instead of live availability

**Current state**

- Production still fails: the page announces `Preview availability` and shows fake booked/full dates even though `/api/availability` returns 184 live days and the transactional database is empty.
- A local safety change replaces fake fallback counts with disabled `Availability unavailable` dates in both `src/parent-booking.html` and the current root `parent.html` diff.
- A local experimental wrapper change adds `connect-src 'self'` and `allow-same-origin` to `parent.html`. It has not been deployed and should not be treated as the final architectural fix.

**Confirmed cause**

- The deployed application script runs in a sandboxed `srcdoc` iframe with `allow-scripts` but without a same-origin capability. Its origin is opaque, while its CSP originally allows only `blob:` and `data:` connections. The iframe therefore cannot successfully consume same-origin `/api/availability`.
- `loadAvailability()` catches that failure and leaves `fallbackDayData` active. The production fallback contains invented capacity values.
- Adding both `allow-scripts` and `allow-same-origin` to same-origin content weakens the value of the sandbox and still leaves the navigation/scroll problems. It is a diagnostic/local workaround, not the preferred final design.

**Relevant code**

- `parent.html`: outer CSP, iframe `sandbox`, fixed-height wrapper, and encoded copy of the entire application.
- `src/parent-booking.html`: `fallbackDayData`, `loadAvailability()`, `monthKeys`, and calendar rendering.
- `api/availability.js` and `public.stay_play_availability()`: confirmed-good live source.

**Recommended fix direction**

1. Make the parent app a normal top-level document instead of an encoded `srcdoc` iframe. Use `src/parent-booking.html` as the source while preserving the required `doctype`, metadata, CSP, and light-mode shell.
2. Keep failure closed: when availability cannot load, dates must be disabled with retry guidance; never render invented booked/open values.
3. Give `connect-src 'self'` only to the top-level parent document and retain `Cache-Control: no-store` on the API.
4. Remove the duplicate generated copy or add a deterministic build script so one canonical source produces `parent.html`.

**Closure tests**

- With an empty database, every open date displays 14 open circles and zero booked circles.
- Insert a precisely identified synthetic booking and confirm the matching date decreases by exactly its child count; remove it and confirm capacity returns.
- Force `/api/availability` to fail and confirm every potentially bookable date is disabled, no fake counts appear, and retry guidance is announced.
- Confirm the badge says `Live availability`, month navigation spans all returned months, and the browser console/network log has no CSP, CORS, opaque-origin, or iframe errors.

### BUG-002 — Parent month selector appears enabled but does not advance

**Current state and cause**

- `monthKeys` starts as `['2026-09']`. The initial code calls `buildCalendar()` directly, not `updateMonth()`, so the Next button keeps its static enabled markup.
- When BUG-001 makes `loadAvailability()` fail, the catch block updates copy but does not call `updateMonth()`. Next remains enabled even though there is only one fallback month, and its handler correctly refuses to increment beyond `monthKeys.length - 1`.
- With live data, `loadAvailability()` replaces `monthKeys` and calls `updateMonth()`, so this bug is partly downstream of BUG-001 but still needs correct initialization/failure behavior.

**Relevant code**

- `src/parent-booking.html`: initialization near `monthKeys`, `updateMonth()`, `loadAvailability()`, and Previous/Next listeners.
- The same encoded code currently exists in `parent.html`; update the canonical source and deployed page together.

**Recommended fix direction**

- Initialize through `updateMonth()` rather than `buildCalendar()`, and call it again in the availability-failure path.
- Derive button disabled states exclusively from `currentMonthIndex` and `monthKeys.length` after every data load or failure.
- Preserve assignments when moving between months and make the selected/default month the first month containing an actually bookable day.

**Closure tests**

- Live Session 1 moves September → October → November → December exactly once per click and returns correctly.
- Session 2 months appear only when returned/configured, while booking-disabled dates remain disabled.
- At the first/last month, only the correct arrow is disabled. With an API failure and one fallback month, both arrows are disabled.
- Keyboard activation and accessible month-label changes work without losing child/date assignments.

### BUG-003 — Header Manage booking link breaks inside the parent iframe

**Current state and cause**

- The fragment uses `href="manage.html"`. Inside the `srcdoc` iframe, the click tries to load `manage.html` inside that frame.
- Vercel correctly sends `X-Frame-Options: DENY` for `manage.html`, so the inner navigation is refused and the top-level URL remains `/parent.html`.
- The local `allow-same-origin` change does not grant top-level navigation and does not solve this reliably.

**Relevant code**

- `src/parent-booking.html`: `.rb-help` Manage booking link.
- `parent.html`: sandboxed wrapper.
- `vercel.json`: intentional `X-Frame-Options: DENY` for `/manage.html`; keep this protection.

**Recommended fix direction**

- Resolve with BUG-010 by making the parent app a top-level document. Then use an absolute-root link such as `/manage.html`.
- If an interim iframe fix is unavoidable, it needs a deliberate top-navigation mechanism and regression testing, but do not remove `X-Frame-Options: DENY` from the sensitive manage page merely to make iframe navigation work.

**Closure tests**

- Mouse and keyboard activation from the parent header navigate the top-level browser to `/manage.html`.
- Back returns to the parent page without a refused-frame error.
- Direct `/manage.html` remains non-frameable and its secure-token flow still works.

### BUG-004 — Unnecessary header links point to `#`

**Current state and cause**

- `Programs`, `About Us`, and `Admissions` are presentation-only links with `href="#"`; they add no product value and create misleading keyboard stops.
- The brand link in the fragment also points to `#`; decide whether it should go to the app landing page or be noninteractive.

**Relevant code**

- `src/parent-booking.html` header and the encoded copy in `parent.html`.

**Recommended fix direction and closure**

- Remove the three unused navigation links. Keep only the Red Barn brand and the working Manage booking action.
- Point the brand to a real intended destination (`/` is the current app landing page) or render it without link semantics.
- Verify there are no `href="#"` controls, the header remains balanced at desktop/mobile widths, and the keyboard order contains only working actions.

### BUG-005 — Children count badge becomes stale after typing a name

**Current state and confirmed cause**

- `renderChildren()` sets `childCount.textContent = namedChildren().length`.
- A child input event changes `child.name`, then calls `renderTargets()`, `updateCalendar()`, and `updateSummary()`—but not the count update. The badge therefore changes when rows are added/removed but not when a blank row becomes named or a name is cleared.

**Relevant code**

- `src/parent-booking.html`: `renderChildren()`, the dynamically created child input listener, `namedChildren()`, and `addChild()`/`removeChild()`.

**Recommended fix direction**

- Extract a small `updateChildCount()` helper and call it from both `renderChildren()` and the input listener. Avoid rerendering the entire child list on every keystroke because that would replace the focused input/caret.

**Closure tests**

- Initial blank form shows 0 named children.
- Typing Ava changes 0 → 1; adding a blank row stays 1; typing Leo changes 1 → 2; clearing Leo returns to 1; removing Ava returns to 0.
- Everyone count, child chips, badge, review-button state, assignments, and six-child limit remain consistent.

### BUG-006 — Review dialog does not close with Escape

**Current state and confirmed cause**

- The custom review overlay supports its Close button and backdrop click, but its application script registers no `keydown` handler for Escape.
- The Escape-related code later in generated `parent.html` belongs to the visualization wrapper runtime, not the inner booking review overlay, so it does not close this dialog.

**Relevant code**

- `src/parent-booking.html`: `openReview()`, Close listener, backdrop listener, and `.rb-review-backdrop` markup.

**Recommended fix direction**

- Prefer the native `<dialog>` element if the direct-document refactor is happening; otherwise add an Escape handler only while the overlay is open.
- Preserve the trigger element, close on Escape, restore focus to `Review booking`, and prevent focus from escaping behind the modal. Do not submit or clear the booking when dismissing.

**Closure tests**

- Close button, backdrop, and Escape each close the overlay and return focus to Review booking.
- Tab/Shift+Tab stay inside the open modal, screen readers see one named modal, and repeated open/close cycles do not accumulate listeners.
- Confirm remains protected against double submission.

### BUG-007 — Manage-link endpoint reveals known booking emails during provider failure

**Current state and confirmed cause**

- Unknown email: the RPC returns no sendable link and the endpoint returns generic HTTP 200.
- Known email with current Resend failure: `sendManageLinkEmail()` throws, the outer catch returns HTTP 503 with `Email is temporarily unavailable`.
- Comparing these responses reveals whether an address has an active family/booking, contradicting the page’s privacy promise.

**Relevant code**

- `api/manage/request-link.js`: the catch currently emits 503.
- `manage.html`: displays the non-200 error verbatim.
- `api/_lib/email.js`: Resend request and sender configuration.
- The new `api/staff/request-link.js` is a useful pattern: it logs internal failures but always returns the same generic browser response.

**Recommended fix direction**

- Make every syntactically acceptable request return the same HTTP status and generic body regardless of unknown email, inactive/no booking, rate limit, database failure, or email-provider failure.
- Log failures server-side with no raw token. Keep rate limiting and hashed-token storage.
- Consider recording delivery failure in `stay_play_email_deliveries`; do not expose it to the requester.

**Closure tests**

- Byte-for-byte compare status/body for invalid-length, unknown, known, rate-limited, inactive/no-active-booking, database-failure, and provider-failure cases.
- Confirm a successful known request still creates only a 32-byte token hash and sends a fragment URL.
- Confirm logs contain no raw link token and rapid retries cannot generate unbounded email attempts.

### BUG-008 — Hosted staff dashboard is not yet protected

**Current state**

- The passwordless whitelist implementation is complete locally and documented in `docs/STAFF_AUTH_PLAN.md`.
- Live RBNS migration `20260825045423_staff_auth` is applied and verified. The staff tables are empty; no administrator has been seeded.
- Local `staff.html` checks `/api/staff/session`, redeems `#staff-token`, hides the iframe until authenticated, and exposes Sign out. Production remains on the old public version until deployment.

**Relevant code**

- `staff-login.html`; `api/staff/*`; `api/_lib/staff-auth.js`; `api/_lib/tokens.js`; `api/_lib/email.js`; `staff.html`; `vercel.json`.
- `supabase/migrations/20260825045423_staff_auth.sql` and the appended staff-auth section of `supabase/schema.sql`.

**Remaining work and guardrails**

1. Obtain the first administrator email and optional display name from the user; never guess it.
2. Review, commit, push, and deploy the local auth changes.
3. Add the first row to `stay_play_staff_members` only in the RBNS project.
4. Complete real emailed-link, one-use, expiry, logout, deactivation, and role tests.
5. Keep all live roster/billing endpoints behind `requireStaffSession`; hiding HTML alone is not authorization.

**Closure tests**

- An unauthenticated production request never displays the dashboard and redirects to `/staff-login.html`.
- Unknown and authorized email requests look identical in the browser; only authorized active staff receive an email attempt.
- A valid link works once, creates an HttpOnly/Secure/SameSite session, and removes the token fragment from history.
- Reuse, expiry, logout, session revocation, and staff deactivation all fail closed.
- A normal staff session cannot perform future admin-only whitelist operations.

### BUG-009 — Staff schedule and billing are static and root/source copies are out of sync

**Current state and confirmed cause**

- Production/root `staff.html` still embeds invented families, emails, rosters, `$475`, and date counts.
- The local editable `src/staff-dashboard.html` has been cleared to zero/empty demo state, but that change was not propagated into the root deployable page.
- Neither copy loads live schedule, roster, billing-line, family-summary, or status data. Existing interactions mutate only the DOM.

**Relevant code and database assets**

- `src/staff-dashboard.html`: canonical-looking fragment with static `scheduleDays`, `rosterByDay`, tables, filters, and DOM-only status handling.
- `staff.html`: deployable encoded copy plus the new auth gate; currently stale relative to `src/`.
- Supabase views `stay_play_billing_lines` and `stay_play_billing_family_summary` already calculate family-day rates and totals and are service-role-only.
- `stay_play_billing_runs`, `stay_play_family_statements`, and `stay_play_statement_items` exist for durable billing batches/statuses.
- The database `stay_play_family_statements.status` check currently permits `ready`, `sent`, and `paid` but **not** the UI’s `waived`; resolve this before persisting Waived.

**Recommended fix direction**

1. Finish BUG-008 first.
2. Add session-protected staff endpoints for schedule/month availability, a date roster, billing lines, family summaries, and status mutation. Return the minimum fields needed by each view.
3. Decide billing semantics: a family status should belong to a defined billing run/statement, not an unbounded mutation of all historical charges.
4. Add `waived` through a reviewed migration if it remains a required status, including how waived totals are represented.
5. Replace static arrays/tables with API-rendered empty/loading/error/data states. Never ship real family data inside HTML.
6. Establish one canonical page/build path so `src/staff-dashboard.html` and `staff.html` cannot drift again.

**Closure tests**

- Clean database shows 0/14 for every open date, empty roster, zero families, and `$0`.
- Synthetic bookings appear on exactly the correct dates with the correct child count, roster identity/contact, rate number, `$50`/`$75` family-day amount, and summary total.
- Late-cancelled items stay billable; on-time cancelled items disappear from billable totals and free capacity.
- Missing/expired/ordinary-vs-admin staff sessions are rejected appropriately, and no endpoint leaks a different family’s data accidentally.

### BUG-010 — Fixed-height `srcdoc` wrappers create nested scrolling and boundary failures

**Current state and cause**

- `parent.html` and `staff.html` each wrap a complete application in an iframe with `height: calc(100vh - 2rem)`.
- The iframe document can be taller than its viewport, creating a page-within-page scroll. It also creates a separate navigation, CSP, origin, focus, and accessibility boundary.
- This architecture directly contributes to the live-API failure and Manage booking navigation failure. It also makes source maintenance error-prone because the application is HTML-encoded inside another file.

**Recommended fix direction**

- Convert parent and staff pages into normal top-level documents. Preserve the current Red Barn fragment markup/styles/scripts, but remove the generated visualization shell, encoded `srcdoc`, iframe sandbox, and fixed viewport height.
- Keep `manage.html` and `staff-login.html` as direct documents; use their structure as the deployment model.
- Add a deterministic build step only if fragments must remain reusable. Document the exact command and make CI fail on generated-file drift.

**Closure tests**

- At 1440×900, 1024×768, 390×844, and 320×568 there is one page scrollbar, no inner scrolling region for the application, and no horizontal overflow.
- Links navigate the top-level page; live APIs use the intended same origin; focus order is continuous; browser Back works.
- Parent selections, review modal, staff gate, schedule, and billing remain functional after the structural move.

### BUG-011 — Download CSV only changes button text

**Current state and confirmed cause**

- The click handler changes the button to `CSV ready` and writes feedback. It never creates CSV bytes, a Blob, an object URL, or a download.
- Because the tables are still static, implementing export before BUG-009 would only export preview rows.

**Relevant code**

- `src/staff-dashboard.html`: `#rb-export` handler and the two report tables; stale encoded copy in `staff.html`.

**Recommended fix direction**

- Implement after live report data exists. Export the currently selected report, period, and filters from the same normalized data used to render the table.
- Charges CSV should include service date, family, email if approved, children, child-spots, rate number, rate in dollars, status, and stable record identifiers needed for BILL.com/manual reconciliation.
- Family CSV should include family, email, billable dates, child-spots, rate mix, total in dollars, and statement status.
- Escape quotes/newlines correctly and neutralize spreadsheet-formula prefixes (`=`, `+`, `-`, `@`) in user-provided text. Use a useful filename containing report type and period.

**Closure tests**

- Clicking creates exactly one downloadable `.csv` with the visible filtered rows and totals.
- `$50`, `$75`, and summary totals are correct; names containing commas/quotes/newlines round-trip safely; formula-like names cannot execute as spreadsheet formulas.
- Empty results produce a header-only file or a clearly documented no-data behavior, not a fake success.

### BUG-012 — Booking confirmation email omits reservation and billing details

**Current state and cause**

- `sendBookingConfirmationEmail()` receives only recipient, parent name, confirmation code, manage URL, and booking ID.
- Its template therefore cannot list dates, child names, per-day family rates, or total. `create_stay_play_booking()` currently returns only booking ID/code, reserved child-spots, and estimated added charge cents.

**Relevant code**

- `api/bookings.js`; `api/_lib/email.js`; `public.create_stay_play_booking()` in `supabase/schema.sql`.

**Recommended fix direction**

- Return or query a server-authoritative confirmation-detail payload after the transaction: each service date, selected children, child count/rate number, `rate_cents`, and the actual added/charged total.
- Do not reconstruct money solely from untrusted request input. Incremental bookings for another sibling on a day can change a family-day from `$50` to `$75`, so the email must agree with database billing semantics.
- Render escaped names/dates, `$` amounts, total, confirmation code, noon–2:00 PM schedule, cancellation deadline/policy, and secure manage button. Keep the plaintext/token only in the outbound link, never logs or database.

**Closure tests**

- One child/one day shows `$50`; two, three, or four siblings on one day show `$75` total; multiple days sum correctly.
- A later booking that changes an existing family-day sibling rate reports the authoritative added charge and final day rate correctly.
- Email HTML escapes names, matches the API/database result exactly, and still sends a fragment-based manage link.

### BUG-013 — Automated coverage remains incomplete

**Current state**

- `npm test` now runs five passing staff-auth helper tests, so the original zero-test condition is partially resolved.
- There are still no automated tests for booking validation/pricing, concurrency capacity, availability rendering, manage-link privacy, cancellation timing, email content, staff live data, CSV, or browser flows.
- No Playwright dependency/configuration is checked into `package.json`; prior browser QA was run interactively/externally.

**Relevant code**

- `package.json`; `test/staff-auth.test.js`; all `api/` handlers; future browser-test configuration.

**Recommended fix direction**

- Add fast unit tests for token/cookie/email-format and pure rendering/calculation helpers.
- Add handler/RPC integration tests against an isolated Supabase branch or tightly scoped synthetic data, including a 15-request race and guarded cleanup.
- Add Playwright end-to-end tests for parent, manage, and staff login/dashboard at desktop/mobile widths. Use provider stubs or a safe test email capture mechanism so raw tokens are available only to the test process.
- Make CI fail when zero tests run, and run syntax/unit tests on every push; keep data-changing production tests manual or explicitly gated.

**Minimum closure suite**

- `$50`/`$75` pricing, multi-day totals, duplicate protection, 14-slot concurrency, booking/cancellation deadlines, and Session 2 opening.
- Manage/staff request privacy, token one-use/expiry, session/logout/deactivation, and authorization roles.
- Live availability failure-closed state, month navigation, multi-child assignment, Escape/focus behavior, responsive reflow, staff live reports, and CSV content.

### BUG-014 — Historical mobile overflow is a candidate for closure

**Current state**

- Explicit 390×844 and 320×568 rechecks did not reproduce horizontal overflow in parent, manage, or staff pages. The earlier failure may have used a different viewport/device emulation or predated the current responsive fragment.
- Do not delete the history yet: BUG-010’s direct-document refactor can materially change widths and scrolling.

**Closure criteria**

- After the wrapper/direct-document changes are deployed, verify `scrollWidth === clientWidth` at 390 and 320 CSS pixels for parent, manage, staff login, and authenticated staff schedule/billing.
- Capture screenshots and test long realistic names/emails, two-to-six child chips, billing tables, dialogs, and browser zoom/reflow.
- If still clean, mark BUG-014 resolved with the deployment URL/date and evidence paths instead of silently removing it.

### BUG-015 — Dark system preference creates an outer black frame

**Current state and cause**

- The editable fragments declare `color-scheme: light`, but the generated outer `parent.html` shell declares `color-scheme: light dark` and uses `light-dark(...)` for its background. Under a dark OS preference, the white iframe sits inside black outer padding.
- Local `staff.html` now forces a white/light outer shell as part of staff-auth work; production is not updated. `parent.html` still has the dark-capable outer shell.

**Recommended fix direction**

- The direct-document fix for BUG-010 removes the outer-frame mismatch. Explicitly set `:root { color-scheme: light; background: #fff; }` and body background/text colors in each public/staff page.
- Do not add a dark theme unless the school explicitly requests and designs one.

**Closure tests**

- Emulate both `prefers-color-scheme: light` and `dark` at desktop/mobile widths. Parent, manage, staff login, and authenticated staff pages remain white/light with no black border or unexpected UA darkening.
- Recheck form controls, dialogs, focus rings, iframe removal, screenshots, and practical contrast.

### BUG-016 — School closure dates are missing from live configuration

**Current state and blocker**

- Both sessions were generated with every weekday enabled. The live database audit found zero `booking_enabled = false` rows and zero closure notes.
- The preview hardcodes September 23 as `School closed`, but that is not live configuration and must not be assumed correct.
- The school must supply the authoritative closure/holiday dates and desired display labels. Do not infer them from public holidays or the preview.

**Relevant code/data**

- `stay_play_program_days.booking_enabled`, `closure_note`, and `updated_at`.
- `public.stay_play_availability()` already returns the closure fields, and the parent UI already disables a day when `closure_note` is present or booking is disabled.
- `supabase/schema.sql` currently seeds all weekdays via `generate_series`; closure overrides need their own reviewed data migration/configuration step.

**Recommended fix direction**

1. Obtain and confirm the school calendar for both sessions.
2. Add a narrowly scoped, repeatable migration/update that sets exact dates to `booking_enabled = false` and a human-readable `closure_note`.
3. Decide whether unexpected emergency closures need a small admin action later; initially, Supabase Table Editor/manual migration is acceptable.
4. Before closing a day that already has bookings, show staff the affected reservations and define the communication/billing process—do not silently cancel or strand them.

**Closure tests**

- Each supplied closure appears disabled with the correct note in parent and staff calendars; the booking API rejects it even under direct requests/concurrency.
- Adjacent open days remain bookable and capacity remains 14.
- A closure update is repeatable, auditable, limited to exact service dates, and does not modify Sentinel or unrelated program days.

## Run notes

### 2026-08-24 — Baseline

- Confirmed the Supabase transactional database is empty; there were no persisted demo bookings to delete.
- Found hard-coded demo availability in the parent fallback and illustrative roster/billing data in the staff preview.
- Confirmed the hosted parent page is rendering fallback capacity instead of live Supabase availability.
- Began local removal of false demo state and a parent-page CSP/origin correction before the user requested a log-first bug-bash protocol. These local changes have not been deployed and should be reviewed with the eventual fix plan.
- Verified pricing, family-day billing rows, summary totals, validation, session opening, RLS/privileges, and a 15-request capacity race through the hosted API and Supabase.
- Valid cancellation could not be exercised because email delivery cannot return the generated token and privileged token-issuing RPCs are correctly unavailable to the QA connector. Invalid-token behavior passed; valid/expired/cancellation cases remain blocked until the test harness can capture a synthetic token safely.
- After user confirmation, deleted exactly the QA-prefixed synthetic records in one guarded transaction. All transactional tables and tested availability dates returned to their zero-booking baseline.

### 2026-08-25 — MCP-assisted production regression

- Reconfirmed BUG-001 end to end: `/api/availability` returns HTTP 200 with 184 live program days and Sep 14–17 each at 0 booked / 14 open, while the parent page renders `Preview availability` with conflicting demo counts.
- Reconfirmed BUG-002–BUG-006 through browser interaction. For the review dialog, Close and backdrop dismissal work and return focus correctly; Escape still fails.
- Measured responsive behavior at 1440×900, 1024×768, 390×844, and 320×568. The prior horizontal-overflow bug was not reproducible at either mobile width, so BUG-014 is now a candidate for closure. Nested iframe scrolling and the dark outer frame remain reproducible.
- Reconfirmed the public staff page still contains static names, emails, counts, and billing data and remains unauthenticated; no live family data was present in Supabase.
- Used the RBNS-scoped Supabase connection only. All transactional tables remain empty, every listed table has RLS enabled, and security advisors returned informational `RLS enabled/no policy` notices only (the intended deny-by-default posture), with no warning/error lints.
- Reconfirmed session configuration: 14 capacity, 24-hour booking/cancellation cutoffs, `$50` single-child rate, `$75` sibling rate, Session 2 booking opens December 26, and zero disabled/closure days in either session.
- `npm run check` passes; `npm test` still exits successfully with 0 tests and 0 suites (BUG-013).
- The newly registered Vercel MCP OAuth is not exposed to this already-running task's tool inventory; the older Vercel app connector returned no teams/projects, so deployment/runtime-log inspection remains an observability gap for this run. Public Vercel response headers and browser/API behavior were verified directly instead.

### 2026-08-25 — Staff passwordless-auth implementation

- Added a light-mode `/staff-login.html`, passwordless request/redeem/session/logout endpoints, a Resend staff-login template, hashed one-time tokens, seven-day hashed sessions, a secure HttpOnly cookie, a reusable staff-session guard, and a session gate/sign-out action for `/staff.html`.
- Applied and recorded Supabase migration `20260825045423_staff_auth` only in project `jmewsaaexmvnozcjuxdh`. No staff row was seeded and Sentinel was not accessed.
- Independently verified all three new tables are empty, have RLS enabled, deny browser roles, and grant the required table/function access only to `service_role`.
- Supabase advisors reported only informational deny-by-default and unused-index notices; there were no new warning/error findings.
- Local syntax checks, five staff-auth unit tests, unauthenticated redirect, keyboard validation, and responsive checks at 390×844 and 320×568 passed.
- Full email-link redemption, reuse, expiry, logout, and deactivation tests remain blocked until the user supplies the first authorized staff email and the reviewed changes are deployed.

## Visual evidence

- [Parent desktop](qa-evidence/parent-desktop.png)
- [Parent mobile 390×844](qa-evidence/parent-mobile.png)
- [Manage mobile 390×844](qa-evidence/manage-mobile.png)
- [Staff mobile 390×844](qa-evidence/staff-mobile.png)
