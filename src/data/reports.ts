import type { Db } from './db'
import type { TreasurerReport } from '../shared/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The classic meeting report: where every account started and ended over the
 * range, and where the money came from and went by category. Transfers are
 * excluded from income/expense (moving money between your own accounts is
 * neither), but they do move the per-account balances.
 */
export function treasurerReport(
  db: Db,
  dateFrom: string,
  dateTo: string
): TreasurerReport {
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) throw new Error('Invalid date range.')
  if (dateFrom > dateTo) throw new Error('The range must start before it ends.')

  const accounts = db
    .prepare(
      `SELECT a.name,
              a.opening_balance_cents
                + COALESCE(SUM(CASE WHEN t.date < @from THEN t.amount_cents END), 0) AS opening,
              a.opening_balance_cents
                + COALESCE(SUM(CASE WHEN t.date <= @to THEN t.amount_cents END), 0) AS closing
       FROM account a
       LEFT JOIN txn t ON t.account_id = a.id
       WHERE a.is_active = 1
       GROUP BY a.id
       ORDER BY a.sort_order, a.id`
    )
    .all({ from: dateFrom, to: dateTo }) as { name: string; opening: number; closing: number }[]

  const byCategory = (type: 'income' | 'expense'): { category: string; cents: number }[] =>
    (
      db
        .prepare(
          `SELECT c.name AS category, SUM(t.amount_cents) AS total
           FROM txn t JOIN category c ON c.id = t.category_id
           WHERE t.type = @type AND t.date >= @from AND t.date <= @to
           GROUP BY c.id
           ORDER BY c.sort_order, c.name`
        )
        .all({ type, from: dateFrom, to: dateTo }) as { category: string; total: number }[]
    ).map((r) => ({ category: r.category, cents: Math.abs(r.total) }))

  const income = byCategory('income')
  const expense = byCategory('expense')
  const totalIncome = income.reduce((s, r) => s + r.cents, 0)
  const totalExpense = expense.reduce((s, r) => s + r.cents, 0)

  return {
    dateFrom,
    dateTo,
    accounts: accounts.map((a) => ({
      name: a.name,
      openingCents: a.opening,
      closingCents: a.closing
    })),
    incomeByCategory: income,
    expenseByCategory: expense,
    totalIncomeCents: totalIncome,
    totalExpenseCents: totalExpense,
    netCents: totalIncome - totalExpense
  }
}
