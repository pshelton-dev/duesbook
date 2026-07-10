// Generates the Duesbook design-system bundle for claude.ai/design.
// Every preview inlines the REAL app stylesheet so fidelity is exact.
// All sample data is fictional (Maple Grove Garden Club) — never real books.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const css = readFileSync('/Users/pas/Development/Treasurer/src/renderer/src/styles.css', 'utf8')
const OUT = join(dirname(new URL(import.meta.url).pathname), 'bundle')

// Small preview-only helpers (swatches, spacing) — clearly separated from app CSS.
const previewCss = `
.pv-pad { padding: 20px; }
.pv-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.pv-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; margin: 14px 0 6px; }
.sw-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.sw { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
.sw-chip { height: 44px; }
.sw-meta { padding: 6px 8px; font-size: 11px; line-height: 1.5; }
.sw-meta b { display: block; font-size: 12px; }
`

const page = (title, body, { bg = '#fff', pad = true } = {}) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${css}${previewCss}body{background:${bg};}</style></head>
<body>${pad ? `<div class="pv-pad">${body}</div>` : body}</body></html>`

const sw = (hex, name, use) =>
  `<div class="sw"><div class="sw-chip" style="background:${hex}"></div><div class="sw-meta"><b>${name}</b>${hex} · ${use}</div></div>`

const chip = (cls, text) => `<span class="chip ${cls}">${text}</span>`

const pages = []
const add = (path, group, name, subtitle, width, height, html, opts) =>
  pages.push({ path, group, name, subtitle, width, height, html: `<!-- @dsCard group="${group}" name="${name}" subtitle="${subtitle}" width="${width}" height="${height}" -->\n` + page(`Duesbook — ${name}`, html, opts) })

/* ---------------- Tokens ---------------- */

add('tokens/colors.html', 'Colors', 'Palette', 'Bookkeeper green + status colors', 720, 560, `
<div class="pv-label">Core</div>
<div class="sw-grid">
${sw('#1a1a1a', 'Ink', 'text')}
${sw('#666666', 'Muted', 'secondary text')}
${sw('#f4f4f2', 'Sidebar', 'chrome bg')}
${sw('#dddddd', 'Border', 'panels/tables')}
</div>
<div class="pv-label">Accent — bookkeeper green</div>
<div class="sw-grid">
${sw('#3b6d3b', 'Primary', 'buttons, progress')}
${sw('#2f6f2f', 'Positive', 'income amounts')}
${sw('#dce8dc', 'Soft green', 'active nav, paid chip')}
${sw('#f4f9f4', 'Green tint', 'notice panels, active tab')}
</div>
<div class="pv-label">Status</div>
<div class="sw-grid">
${sw('#fdf6ec', 'Warn bg', 'partial, stale backup')}
${sw('#8a6420', 'Warn text', 'with #e0c48c border')}
${sw('#fbeeee', 'Danger bg', 'owed, arrears, errors')}
${sw('#a32d2d', 'Danger text', 'with #d9a0a0 border')}
</div>`)

add('tokens/type.html', 'Type', 'Type scale', 'System stack, 14px base; serif only in reports', 640, 420, `
<h1>Page title — 20px / 600</h1>
<h2>Section head — 15px / 600</h2>
<p class="lead">Lead paragraph — 14px, #444, used to explain a screen in one breath.</p>
<p>Body — 14px #1a1a1a. Tables drop to 13px. Amounts always use <span style="font-variant-numeric: tabular-nums">tabular numerals: $1,234.56</span></p>
<p class="hint">Hint — 12px #777, sits under form fields.</p>
<div class="summary-label" style="margin-top:12px">Summary label — 11px uppercase</div>
<div class="summary-value">$4,812.55</div>
<p style="margin-top:12px">Inline <code>code</code> for file names and CSV headers.</p>
<div class="report-head" style="margin-top:16px"><div class="report-org">Report masthead — Georgia serif</div><div class="report-sub">The one serif moment in the app</div></div>`)

/* ---------------- Components ---------------- */

add('components/buttons.html', 'Components', 'Buttons', 'Default / primary / danger / small / disabled', 640, 180, `
<div class="pv-row">
  <button class="btn">Cancel</button>
  <button class="btn primary">Record payment</button>
  <button class="btn danger">Delete</button>
  <button class="btn small">Waive</button>
  <button class="btn small">Adjust</button>
  <button class="btn" disabled>Save</button>
  <button class="btn primary" disabled>Next</button>
</div>
<p class="hint">One primary action per view. Danger is outline-only until hovered.</p>`)

add('components/chips.html', 'Components', 'Status chips & badges', 'Dues status vocabulary', 640, 220, `
<div class="pv-label">Dues status chips</div>
<div class="pv-row">
${chip('chip-paid', 'Paid')}
${chip('chip-partial', 'Partial · $25.00')}
${chip('chip-owed', 'Owed · $150.00 · 3 mo')}
${chip('chip-waived', 'Waived')}
${chip('chip-exempt', 'Exempt')}
${chip('chip-na', '—')}
</div>
<div class="pv-label">Badges (inline, in tables)</div>
<div class="pv-row">
  <span class="badge ok">DUES</span>
  <span class="badge warn">UNALLOCATED</span>
</div>`)

add('components/panels.html', 'Components', 'Panels', 'Plain / notice / warn / error', 680, 460, `
<div class="panel">Plain panel — groups a settings section or form.</div>
<div class="panel notice"><strong>Backup complete.</strong> 5 backups kept in your backup folder.</div>
<div class="panel warn"><strong>Backup is stale.</strong> Last backup was 9 days ago. <button class="btn small">Back up now</button></div>
<div class="panel error"><strong>2 members are 3+ months behind.</strong>
  <ul class="arrears-list"><li>Ted Kowalski — $150.00 (3 months)</li><li>Ann Whitfield — $200.00 (4 months)</li></ul>
</div>
<div class="panel meta-panel">Meta panel — version 0.1.0 · data file: <code>duesbook.db</code></div>`)

add('components/forms.html', 'Components', 'Form fields', 'Field, row, checkbox, amount, type-ahead', 640, 560, `
<label class="field">Payee<input value="Maple City Utilities" /></label>
<div class="field-row">
  <label class="field">Date<input type="date" value="2026-07-09" /></label>
  <label class="field">Amount<input class="amount-input" value="50.00" /></label>
</div>
<label class="field">Category<select><option>Dues</option><option>Utilities</option></select></label>
<label class="check-field"><input type="checkbox" checked /> Cleared against statement</label>
<label class="field">Member<input value="mi" /></label>
<div class="typeahead">
  <button class="typeahead-item">Jane <b>Mi</b>ller</button>
  <button class="typeahead-item">Luis Ro<b>mi</b>rez</button>
</div>
<p class="hint">Hints sit under fields — plain language, no jargon.</p>`)

add('components/segmented.html', 'Components', 'Segmented control', 'Txn type & report picker; period select', 640, 180, `
<div class="segmented" style="max-width:360px">
  <button class="segment">Income</button>
  <button class="segment active">Expense</button>
  <button class="segment">Transfer</button>
</div>
<div class="pv-row">
  <select class="period-select"><option>Jul 2026</option><option>Jun 2026</option><option>May 2026</option></select>
  <span class="hint" style="margin:0">Period picker — bold, reads as a title</span>
</div>`)

add('components/sidebar.html', 'Components', 'Sidebar navigation', 'App shell — six flat destinations', 720, 420, `
<div class="app" style="height:400px">
  <nav class="sidebar">
    <div class="brand">Duesbook</div>
    <button class="nav-item">Home</button>
    <button class="nav-item active">Ledger</button>
    <button class="nav-item">Members</button>
    <button class="nav-item">Dues</button>
    <button class="nav-item">Reports</button>
    <button class="nav-item">Settings</button>
  </nav>
  <main class="content"><h1>Ledger</h1><p class="lead">Content area scrolls independently; panels cap at 640px.</p></main>
</div>`, { pad: false })

add('components/account-tabs.html', 'Components', 'Account tabs & filter bar', 'Ledger header row', 760, 240, `
<div class="ledger-header">
  <div class="account-tabs">
    <button class="account-tab active"><span class="account-tab-name">Checking</span><span class="account-tab-balance">$4,812.55</span></button>
    <button class="account-tab"><span class="account-tab-name">Savings</span><span class="account-tab-balance">$2,300.00</span></button>
    <button class="account-tab"><span class="account-tab-name">Petty Cash</span><span class="account-tab-balance">$150.00</span></button>
  </div>
  <button class="btn primary">New transaction</button>
</div>
<div class="filter-bar">
  <input class="filter-search" placeholder="Search payee or memo" />
  <input type="date" /><span class="filter-sep">to</span><input type="date" />
  <select><option>All categories</option></select>
  <label class="check-field compact"><input type="checkbox" /> Uncleared only</label>
</div>`)

add('components/summary-bar.html', 'Components', 'Summary bar', 'Dues period at a glance', 680, 150, `
<div class="summary-bar">
  <div class="summary-item"><span class="summary-label">Collected</span><span class="summary-value pos">$200.00</span></div>
  <div class="summary-item"><span class="summary-label">Outstanding</span><span class="summary-value">$100.00</span></div>
  <div class="summary-item"><span class="summary-label">Paid</span><span class="summary-value">4 of 6</span></div>
</div>`)

add('components/balance-cards.html', 'Components', 'Balance cards & progress', 'Home building blocks', 720, 300, `
<div class="balance-cards">
  <div class="balance-card"><div class="summary-label">Checking</div><div class="summary-value">$4,812.55</div></div>
  <div class="balance-card"><div class="summary-label">Savings</div><div class="summary-value">$2,300.00</div></div>
  <div class="balance-card total"><div class="summary-label">Total</div><div class="summary-value">$7,112.55</div></div>
</div>
<div class="dues-progress">
  <div class="dues-progress-head"><span><strong>Jul 2026 dues</strong> — 4 of 6 paid</span><span>$200.00 collected · $100.00 outstanding</span></div>
  <div class="progress-track"><div class="progress-fill" style="width:67%"></div></div>
</div>`)

add('components/register-table.html', 'Components', 'Register table', 'The checkbook — sticky header, running balance', 780, 380, `
<table class="register">
  <thead><tr><th>Date</th><th>Payee</th><th>Category</th><th>Memo</th><th class="num">Amount</th><th class="num">Balance</th><th class="center">✓</th></tr></thead>
  <tbody>
    <tr class="register-row"><td class="nowrap">2026-07-08</td><td>Jane Miller <span class="badge ok">DUES</span></td><td>Dues</td><td class="memo">Check #204 — Jul</td><td class="num pos">$50.00</td><td class="num balance">$4,812.55</td><td class="center"><input type="checkbox"></td></tr>
    <tr class="register-row"><td class="nowrap">2026-07-05</td><td>Maple City Utilities</td><td>Utilities</td><td class="memo">Clubhouse water</td><td class="num">−$63.20</td><td class="num balance">$4,762.55</td><td class="center"><input type="checkbox" checked></td></tr>
    <tr class="register-row"><td class="nowrap">2026-07-01</td><td>Transfer from Savings</td><td>Transfer</td><td class="memo"></td><td class="num pos">$500.00</td><td class="num balance">$4,825.75</td><td class="center"><input type="checkbox" checked></td></tr>
    <tr class="register-row"><td class="nowrap">2026-06-28</td><td>Sam Osei <span class="badge ok">DUES</span></td><td>Dues</td><td class="memo">Cash — Jun + Jul</td><td class="num pos">$100.00</td><td class="num balance">$4,325.75</td><td class="center"><input type="checkbox" checked></td></tr>
    <tr class="register-row"><td class="nowrap">2026-06-20</td><td>Petal Press Printing</td><td>Printing</td><td class="memo">Summer newsletter run, 120 copies</td><td class="num">−$84.00</td><td class="num balance">$4,225.75</td><td class="center"><input type="checkbox" checked></td></tr>
  </tbody>
</table>
<p class="hint">Income green, spending plain — no red ink for normal expenses.</p>`)

add('components/drawer.html', 'Components', 'Edit drawer', 'All editing happens here — never a modal', 780, 580, `
<p class="lead">Right-anchored drawer (380px; 520px for payments). Footer: destructive left, confirm right.</p>
<div class="drawer">
  <div class="drawer-header"><h2>Edit transaction</h2><button class="btn small">Close</button></div>
  <div class="segmented"><button class="segment">Income</button><button class="segment active">Expense</button><button class="segment">Transfer</button></div>
  <label class="field">Payee<input value="Maple City Utilities" /></label>
  <div class="field-row">
    <label class="field">Date<input type="date" value="2026-07-05" /></label>
    <label class="field">Amount<input class="amount-input" value="63.20" /></label>
  </div>
  <label class="field">Category<select><option>Utilities</option></select></label>
  <label class="field">Memo<input value="Clubhouse water" /></label>
  <label class="check-field"><input type="checkbox" checked /> Cleared</label>
  <div class="drawer-footer"><button class="btn danger">Delete</button><div class="btn-row"><button class="btn">Cancel</button><button class="btn primary">Save</button></div></div>
</div>`, { bg: '#f4f4f2' })

/* ---------------- Patterns (full screens) ---------------- */

add('patterns/home.html', 'Patterns', 'Home screen', 'Orientation + warnings, no data entry', 860, 720, `
<h1>Home</h1>
<div class="balance-cards">
  <div class="balance-card"><div class="summary-label">Checking</div><div class="summary-value">$4,812.55</div></div>
  <div class="balance-card"><div class="summary-label">Savings</div><div class="summary-value">$2,300.00</div></div>
  <div class="balance-card total"><div class="summary-label">Total</div><div class="summary-value">$7,112.55</div></div>
</div>
<div class="dues-progress">
  <div class="dues-progress-head"><span><strong>Jul 2026 dues</strong> — 4 of 6 paid</span><span>$200.00 collected · $100.00 outstanding</span></div>
  <div class="progress-track"><div class="progress-fill" style="width:67%"></div></div>
</div>
<div class="panel error" style="margin-top:16px"><strong>2 members are 3+ months behind.</strong>
  <ul class="arrears-list"><li>Ted Kowalski — $150.00 (3 months)</li><li>Ann Whitfield — $200.00 (4 months)</li></ul>
</div>
<div class="panel warn"><strong>Backup is stale.</strong> Last backup was 9 days ago. <button class="btn small">Back up now</button></div>
<h2>Recent activity</h2>
<table class="mini-table">
  <thead><tr><th>Date</th><th>Payee</th><th>Account</th><th class="num">Amount</th></tr></thead>
  <tbody>
    <tr><td>2026-07-08</td><td>Jane Miller</td><td>Checking</td><td class="num pos">$50.00</td></tr>
    <tr><td>2026-07-05</td><td>Maple City Utilities</td><td>Checking</td><td class="num">−$63.20</td></tr>
    <tr><td>2026-07-01</td><td>Transfer from Savings</td><td>Checking</td><td class="num pos">$500.00</td></tr>
  </tbody>
</table>`)

add('patterns/dues.html', 'Patterns', 'Dues screen', 'Period roster — the most-repeated workflow', 860, 640, `
<div class="detail-header" style="margin:0 0 12px"><h1>Dues</h1>
  <div class="btn-row"><select class="period-select"><option>Jul 2026</option></select><button class="btn primary">Record payment</button></div>
</div>
<div class="summary-bar">
  <div class="summary-item"><span class="summary-label">Collected</span><span class="summary-value pos">$200.00</span></div>
  <div class="summary-item"><span class="summary-label">Outstanding</span><span class="summary-value">$100.00</span></div>
  <div class="summary-item"><span class="summary-label">Paid</span><span class="summary-value">4 of 6</span></div>
</div>
<table class="mini-table">
  <thead><tr><th>Member</th><th class="num">Owed</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th><th></th></tr></thead>
  <tbody>
    <tr><td>Jane Miller</td><td class="num">$50.00</td><td class="num">$50.00</td><td class="num">$0.00</td><td>${chip('chip-paid', 'Paid')}</td><td class="row-actions"><button class="btn small">History</button></td></tr>
    <tr><td>Ted Kowalski</td><td class="num">$50.00</td><td class="num">$0.00</td><td class="num">$50.00</td><td>${chip('chip-owed', 'Owed')}</td><td class="row-actions"><button class="btn small">Pay</button><button class="btn small">Waive</button></td></tr>
    <tr><td>Priya Nair</td><td class="num">$50.00</td><td class="num">$25.00</td><td class="num">$25.00</td><td>${chip('chip-partial', 'Partial')}</td><td class="row-actions"><button class="btn small">Pay</button></td></tr>
    <tr><td>Luis Romero</td><td class="num">$0.00</td><td class="num">—</td><td class="num">—</td><td>${chip('chip-waived', 'Waived')}</td><td class="row-actions"><button class="btn small">Adjust</button></td></tr>
  </tbody>
</table>`)

add('patterns/report-sheet.html', 'Patterns', 'Report sheet', 'Print-ready — serif masthead, ruled totals', 820, 680, `
<div class="report-page">
  <div class="report-head">
    <div class="report-org">Maple Grove Garden Club</div>
    <div class="report-title">Treasurer’s Report</div>
    <div class="report-sub">June 1 – June 30, 2026 · generated July 9, 2026</div>
  </div>
  <div class="report-columns">
    <table class="report-table">
      <thead><tr><th>Income</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr><td>Dues</td><td class="num">$250.00</td></tr>
        <tr><td>Plant sale</td><td class="num">$412.00</td></tr>
        <tr class="total-row"><td>Total income</td><td class="num">$662.00</td></tr>
      </tbody>
    </table>
    <table class="report-table">
      <thead><tr><th>Expenses</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr><td>Printing</td><td class="num">$84.00</td></tr>
        <tr><td>Utilities</td><td class="num">$63.20</td></tr>
        <tr class="total-row"><td>Total expenses</td><td class="num">$147.20</td></tr>
      </tbody>
    </table>
  </div>
  <div class="report-net"><strong>Net for period: $514.80</strong></div>
</div>`, { bg: '#fafaf8' })

add('patterns/wizard.html', 'Patterns', 'First-run wizard', 'Centered card, step pills, back/next', 860, 600, `
<div class="wizard-backdrop" style="height:580px">
  <div class="wizard" style="max-height:540px">
    <div class="wizard-steps">
      <span class="wizard-step done"><span class="wizard-step-num">1</span> Organization</span>
      <span class="wizard-step current"><span class="wizard-step-num">2</span> Accounts</span>
      <span class="wizard-step"><span class="wizard-step-num">3</span> Backups</span>
      <span class="wizard-step"><span class="wizard-step-num">4</span> Dues</span>
      <span class="wizard-step"><span class="wizard-step-num">5</span> Members</span>
    </div>
    <div class="wizard-body">
      <h2 style="margin-top:0">Your accounts</h2>
      <p class="lead">Enter the balance from your most recent statement for each account.</p>
      <div class="add-form">
        <label class="field">Account name<input value="Checking" /></label>
        <label class="field">Opening balance<input class="amount-input" value="4812.55" /></label>
        <label class="field">As of<input type="date" value="2026-06-30" /></label>
        <button class="btn">Add</button>
      </div>
      <table class="mini-table" style="margin-top:14px">
        <thead><tr><th>Account</th><th class="num">Opening balance</th><th>As of</th></tr></thead>
        <tbody><tr><td>Petty Cash</td><td class="num">$150.00</td><td>2026-06-30</td></tr></tbody>
      </table>
    </div>
    <div class="wizard-footer"><button class="btn">Back</button><button class="btn primary">Next</button></div>
  </div>
</div>`, { pad: false })

/* ---------------- write ---------------- */

for (const p of pages) {
  const f = join(OUT, p.path)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, p.html)
}
mkdirSync(join(OUT, 'reference'), { recursive: true })
writeFileSync(join(OUT, 'reference', 'styles.css'), css)
writeFileSync(
  join(OUT, 'reference', 'README.md'),
  `# Duesbook design bundle

Previews are generated from the app's real stylesheet (reference/styles.css —
verbatim copy from src/renderer/src/styles.css). Sample data is fictional.
See DESIGN-BRIEF.md in the app repo for full context and the improvement agenda.
`
)
console.log(`${pages.length} previews + reference written to ${OUT}`)
console.log(pages.map((p) => p.path).join('\n'))
