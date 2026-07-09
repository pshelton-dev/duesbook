# Duesbook — v1.1 wishlist

Findings from the real-data pilot and deferred ideas. Not commitments —
candidates, roughly ordered by how much pain they remove.

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
- Bank CSV/OFX import
- Multi-org (File → Open), app-level encryption, non-USD currencies
