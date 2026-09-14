import type { DuesRoster, TreasurerReport } from '../shared/types'
import { formatCents } from '../shared/money'
import { statusLabel } from './theme'

/**
 * The print-styled report sheet from the desktop app, as HTML for the PDF
 * that Share hands to the share sheet. The on-screen preview is native.
 */
const CSS = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #16281a; margin: 40px; font-size: 13px; }
  .head { border-bottom: 2px solid #16281a; padding-bottom: 12px; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', serif; }
  .org { font-size: 20px; font-weight: 700; }
  .title { font-size: 15px; margin-top: 2px; }
  .sub { font-size: 12px; color: #6f7a72; margin-top: 2px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e7e9e4; }
  th { font-weight: 600; border-bottom: 2px solid #16281a; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 600; border-top: 2px solid #16281a; border-bottom: none; }
  .net { font-size: 14px; text-align: right; }
`

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function shell(orgName: string, title: string, subtitle: string, body: string): string {
  const generated = new Date().toISOString().slice(0, 10)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="head"><div class="org">${esc(orgName)}</div><div class="title">${esc(title)}</div>
    <div class="sub">${esc(subtitle)} · generated ${generated}</div></div>${body}</body></html>`
}

export function treasurerReportHtml(orgName: string, title: string, r: TreasurerReport): string {
  const rows = (items: { name?: string; category?: string; cents: number }[]): string =>
    items.map((i) => `<tr><td>${esc(i.name ?? i.category ?? '')}</td><td class="num">${formatCents(i.cents)}</td></tr>`).join('')
  const body = `
    <table><tr><th>Opening balances</th><th class="num">${esc(r.dateFrom)}</th></tr>
      ${rows(r.accounts.map((a) => ({ name: a.name, cents: a.openingCents })))}
      <tr class="total"><td>Total</td><td class="num">${formatCents(r.accounts.reduce((s, a) => s + a.openingCents, 0))}</td></tr></table>
    <table><tr><th>Income</th><th></th></tr>${rows(r.incomeByCategory)}
      <tr class="total"><td>Total income</td><td class="num">${formatCents(r.totalIncomeCents)}</td></tr></table>
    <table><tr><th>Expenses</th><th></th></tr>${rows(r.expenseByCategory)}
      <tr class="total"><td>Total expenses</td><td class="num">${formatCents(r.totalExpenseCents)}</td></tr></table>
    <p class="net">Net for the period: <strong>${formatCents(r.netCents)}</strong></p>
    <table><tr><th>Closing balances</th><th class="num">${esc(r.dateTo)}</th></tr>
      ${rows(r.accounts.map((a) => ({ name: a.name, cents: a.closingCents })))}
      <tr class="total"><td>Total</td><td class="num">${formatCents(r.accounts.reduce((s, a) => s + a.closingCents, 0))}</td></tr></table>`
  return shell(orgName, title, `${r.dateFrom} through ${r.dateTo}`, body)
}

export function rosterHtml(orgName: string, periodLabel: string, roster: DuesRoster): string {
  const body = `
    <table><tr><th>Member</th><th class="num">Owes</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th></tr>
      ${roster.rows
        .map(
          (m) =>
            `<tr><td>${esc(`${m.lastName}, ${m.firstName}`)}${m.overrideNote ? ` <span style="color:#8a938c">— ${esc(m.overrideNote)}</span>` : ''}</td>
             <td class="num">${formatCents(m.baseCents)}</td><td class="num">${m.paidCents ? formatCents(m.paidCents) : '—'}</td>
             <td class="num">${m.outstandingCents ? formatCents(m.outstandingCents) : '—'}</td><td>${statusLabel[m.status]}</td></tr>`
        )
        .join('')}
      <tr class="total"><td>Total</td><td></td><td class="num">${formatCents(roster.summary.collectedCents)}</td>
        <td class="num">${formatCents(roster.summary.outstandingCents)}</td><td>${roster.summary.paidCount} of ${roster.summary.expectedCount} paid</td></tr></table>`
  return shell(orgName, 'Dues status roster', `Dues period ${periodLabel}`, body)
}
