// forecastReportSections.js — Reports-hub section builder for the Forecast
// Expense report. Sequences the same pipeline GeneralExpensesTab.jsx
// computes via React hooks (dataMonths -> rows -> core row -> forecast ->
// variance), but as a plain async function — reusing the tab's exported
// math functions directly so the numbers can't drift out of sync with what
// the live Forecast Expense tab shows.
import {
  loadLinkedRows,
  computeForecast,
  getCoreMonthTotal,
  computeCatStats,
  computeRowStats,
  monthsBetween,
  monthLabel,
  addMonths,
} from '../modules/ems/expense-management/GeneralExpensesTab'

export const buildForecastSections = async ({ start, end }) => {
  const dataMonths = monthsBetween(start, end)
  const rows = await loadLinkedRows(dataMonths)
  const visibleRows = rows.filter((r) => !r.hidden)

  const coreMonthTotals = Object.fromEntries(
    await Promise.all(dataMonths.map((ym) => getCoreMonthTotal(ym).then((total) => [ym, total]))),
  )
  const coreRow = {
    id: 'core:salary',
    category: 'Core',
    vendor: 'General Expenses',
    service: 'Core Team Salary',
    frequency: 'Monthly',
    annualCommitment: 0,
    values: Object.fromEntries(dataMonths.map((ym) => [ym, coreMonthTotals[ym] ?? 0])),
    hidden: false,
    linkRef: { store: 'core' },
  }
  const allVisibleRows = [...visibleRows, coreRow]

  const activeDataMonths = dataMonths.filter((m) =>
    allVisibleRows.some((r) => {
      const v = r.values[m]
      if (r.id === 'core:salary') return v !== undefined && v !== null && v > 0
      return v !== undefined && v !== null
    }),
  )

  const lastData = activeDataMonths[activeDataMonths.length - 1]
  const forecastMonth = lastData ? addMonths(lastData, 1) : addMonths(end, 1)

  const forecastValues = {}
  allVisibleRows.forEach((r) => {
    const vals = activeDataMonths.map((m) => r.values[m])
    forecastValues[r.id] = computeForecast(vals).value
  })

  const monthTotals = dataMonths.map((m) => ({
    month: m,
    total: allVisibleRows.reduce((s, r) => s + (r.values[m] || 0), 0),
  }))
  const forecastTotal = allVisibleRows.reduce((s, r) => s + (forecastValues[r.id] || 0), 0)
  const avgActual = monthTotals.length
    ? Math.round(monthTotals.reduce((s, m) => s + m.total, 0) / monthTotals.length)
    : 0

  const catStats = computeCatStats(allVisibleRows, dataMonths, forecastValues)
  const rowStats = computeRowStats(allVisibleRows, dataMonths, forecastValues)

  return [
    {
      key: 'byCategory',
      title: 'By Category',
      headers: ['Category', `${dataMonths.length}-Month Avg Actual`, 'Forecast', 'Change'],
      rows: catStats.map((c) => [c.cat, c.avg, c.forecast, c.diff]),
      currencyCols: [1, 2, 3],
    },
    {
      key: 'byMonth',
      title: 'By Month',
      kv: [
        ['Forecast Month', monthLabel(forecastMonth)],
        [`${dataMonths.length}-Month Avg Actual`, avgActual, 'currency'],
        ['Forecast Total', forecastTotal, 'currency'],
      ],
      headers: ['Month', 'Total'],
      rows: [
        ...monthTotals.map((m) => [monthLabel(m.month), m.total]),
        [`${monthLabel(forecastMonth)} (Forecast)`, forecastTotal],
      ],
      currencyCols: [1],
    },
    {
      key: 'variance',
      title: 'Variance / Baseline vs Forecast',
      headers: ['Category', 'Vendor', 'Service', 'Baseline', 'Forecast', 'Change', '% Change'],
      rows: rowStats.map((r) => [
        r.category,
        r.vendor,
        r.service,
        r.baseline,
        r.forecast,
        r.diff,
        r.pct === null ? '—' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)}%`,
      ]),
      currencyCols: [3, 4, 5],
    },
  ]
}

export const FORECAST_SECTION_DEFS = [
  { key: 'byCategory', label: 'By Category' },
  { key: 'byMonth', label: 'By Month' },
  { key: 'variance', label: 'Variance / Baseline vs Forecast' },
]
