# Duesbook — v1.1 wishlist

Findings from the real-data pilot and deferred ideas. Not commitments —
candidates, roughly ordered by how much pain they remove.

## Shipped since this list was written

- **UI redesign** (2026-07-10, commit `1207d21`): bento-card look, single-green
  identity, dot statuses with separate Due/Behind columns, drawer scrim. All
  six screens + drawers + the **first-run wizard** were restyled and verified.
  Note: this was cosmetic only — item 1 below (the wizard's books-start-date
  question) is a *functional* change and remains open.
- **Bank import** (2026-07-11, v1.2.0): pulled forward from the deferred list.
  File-based import (CSV, Excel, OFX/QFX) into the ledger, reconciliation-aware
  — re-imports and hand-entered entries never double-count. See
  BANK-IMPORT-PLAN.md. Live bank connections remain a permanent non-goal.

1. **Wizard: ask when the books should start.** (Pilot finding, 2026-07-08.)
   The wizard says "enter the balance from your most recent statement" but
   also lets you create a dues period that starts months earlier. Those two
   choices silently conflict: recording historical dues payments then
   double-counts money already inside the opening balance. The wizard should
   ask "When do you want your books to start?" and align the opening-balance
   as-of date with the first dues period — plus a hint explaining the
   full-history vs. forward-only tradeoff.

2. **First backup should run right after the wizard completes.** The launch
   auto-backup fires before a first-run wizard has set the backup folder, so
   a brand-new org has no backup until its second launch (or a manual
   Back up now).

3. **After a restore, "Last backup" shows "never".** Snapshot is taken before
   its own timestamp is written. Self-heals on next launch; cosmetic.

## Deferred from v1 (see REQUIREMENTS.md non-goals)

- Membership tiers / per-member dues amounts
- Budget vs. actual
- Receipt/document attachments on transactions
- Household grouping / custom member fields
- Inline register editing in the ledger
- Multi-org (File → Open), app-level encryption, non-USD currencies
