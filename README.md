# Red Barn Nursery School Stay & Play

Interactive front-end prototypes for a preschool Stay & Play scheduling system.

## Included views

- **Parent booking:** A shared public form where parents enter contact and child names, assign children to dates, see remaining capacity, and review charges.
- **Staff dashboard:** A staff schedule with date-level rosters and a billing report with charge detail, family totals, and `Ready`, `Sent`, `Paid`, and `Waived` statuses.

## Current rules represented

- Stay & Play runs from noon to 2:00 PM.
- Each date has a maximum of 14 child-spots.
- One child costs **$50 per family per day**.
- Two or more siblings cost **$75 per family per day**.
- Parents must book or cancel by noon the day before.
- Late cancellations remain billable.

## Run locally

No build step or dependencies are required. Open `index.html` in a browser, or serve the folder with any static web server.

## Project status

This repository currently contains interactive prototypes with illustrative data. Supabase persistence, transactional capacity enforcement, email notifications, and BILL.com integration are planned but not yet connected.

The editable prototype fragments are in `src/`. The root `parent.html` and `staff.html` files are standalone previews.
