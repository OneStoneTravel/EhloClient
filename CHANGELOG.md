# Ehlo Client — Changelog

## 1.4 — Jul 27, 2026
**Fixed**
- Critical bug: the `travelers` table was missing an UPDATE permission, so saving a traveler's hotel/car loyalty numbers silently failed — it looked like it saved, but nothing was actually written to the database.

## 1.3 — Jul 27, 2026
**Added**
- Directory now has a "Travelers" button per client, opening a way to view/add travelers and store each one's hotel and rental car loyalty numbers — these show up automatically in Knox Tracker when booking a hotel or car for them.
- Billing now receives hotel and rental car costs automatically from Knox Tracker, alongside flight costs, whenever a trip includes them.

## 1.2 — Jul 25, 2026
**Added**
- Home now shows how many trips are on the books for today and tomorrow, pulled live from Knox Tracker — a quick read on how busy the team is.
- Cross-system features shared with Knox Tracker: booking fees auto-logged when a trip is confirmed, client budget visibility, traveler trip history, and a disruption-to-billing flag — all show up automatically in Billing and Client Notes without any extra work on Ehlo's side.

## 1.1 — Jul 25, 2026
**Fixed**
- Critical bug: an infinite-recursion error in the owner-access check (`is_owner()`) was causing Billing, Revenue, Expense, and History to fail to load for some owner accounts, even though login worked fine. Fixed by having that check bypass its own permission check internally.
- Tables were clipping extra columns instead of allowing horizontal scroll on narrow screens — a real mobile usability bug, not just a style issue.

**Added**
- Personalized greeting on Home ("Good morning/afternoon/evening" or "Have a good night" after 9pm), using the signed-in owner's actual first name.
- Error resilience: if a tab hits an unexpected error, only that tab breaks now — the top bar and Sign Out button keep working regardless. A stuck request also now times out with a clear message instead of spinning forever.

## 1.0 — Jul 25, 2026
First real release — a full client account and billing system for OneStone Travel, separate from Knox Tracker but sharing the same client/traveler data and staff logins.

**Home**
- Overview dashboard: total clients, retainer collected, booking fees, total revenue, operating expenses, and Profit — all for the current month.
- "Needs attention" panel: clients near or over their monthly threshold, and outstanding retainers sorted by how overdue they are.
- Recent activity feed with a link into full History.
- Personalized greeting (Good morning/afternoon/evening, or "Have a good night" late at night) using the signed-in owner's actual first name.

**New Client**
- Create a client: company info, plan tier (Starter/Growth/Premier/Anchor), monthly threshold, retainer due day, authorized contact (name, phone, email), and an initial list of travelers.

**Billing**
- Per-client monthly threshold tracking with a color-coded bar (green → amber → orange → red).
- Month navigation (browse any past month, not just the current one).
- Spend-by-traveler breakdown (flight/hotel/car/fees).
- Expense entry log with edit/remove and full audit trail (who, when).
- Retainer paid/unpaid toggle.
- Year-to-date spend tracking.
- Click a plan tier badge to see its full pricing and rate details.
- Proration calculator for a client's first partial-month charge.
- Persistent, timestamped client notes.
- Generate a report preview for the current month.

**Directory**
- Searchable client list with plan, contact info, tenure, and retainer due status.
- Edit any client's details, including client number, plan, threshold, and due day.
- End service / Reactivate a client — stops future revenue projections and removes them from Knox Tracker's trip form, without touching any historical data.

**Revenue**
- Toggle between "This month" and "Year to date."
- Revenue by plan tier, highest/lowest paying clients (month and year), revenue growth vs. last month, client concentration risk.
- Predictable next-month revenue (retainers only) and average revenue per client.
- Profit card (revenue minus operating expenses).
- Download a revenue CSV or print a summary report — ready for a tax professional or QuickBooks.

**Expense**
- OneStone's own operating costs, separate from client travel spend: Software & Subscriptions, Office & Rent, Marketing, Insurance, Staff Travel, and one-off Payroll adjustments.
- Payroll now calculates automatically from the Time tab (hours × each staff member's rate) — no manual entry needed.
- Payroll as a percentage of total expense.
- Month navigation and a printable payroll report.

**Reports**
- Generate and print a report for any client, for any past month.

**Time**
- Weekly timecard grid — staff down the left, days across the top.
- Clock in / lunch out / lunch in / clock out punches per day, with hours calculated automatically.
- Printable weekly report (hours and pay per staff member).

**Staff**
- Real HR record: add a new hire (name, contact info, DOB, address, hourly rate, hire date).
- Terminate a staff member (stops future payroll automatically, keeps history intact) or reactivate them.
- Manage who has owner-level access to Ehlo itself.

**History**
- Full, timestamped activity log across every action in the system, grouped by month.

**Under the hood**
- Owner-only access — regular staff logins work fine in Knox Tracker but are blocked entirely from Ehlo.
- Shared client/traveler database with Knox Tracker, so a new client added in Ehlo appears in Knox automatically.
- Mobile-friendly tables (fixed an issue where columns could get clipped instead of scrolling on a phone).
