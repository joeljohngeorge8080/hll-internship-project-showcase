/**
 * MonthAtGlanceWidget.jsx  ─  "This Month at a Glance"
 *
 * 3 giant numbers the CEO sees at a glance:
 *   1. Total Money Spent This Month (general expenses actuals)
 *   2. Payroll This Month (active employee salaries)
 *   3. Active Projects This Month (ongoing count)
 *
 * Plain English labels, big colourful numbers, no jargon.
 */
import React, { useEffect, useState } from 'react'
import WidgetCard from '../../../../components/dashboard/WidgetCard'
import { cilCalendar } from '@coreui/icons'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'
import { localEmployees } from '../../../../services/localEmployees'
import { localProjects } from '../../../../services/localProjects'
import { localOrgPool } from '../../../../services/localOrgPool'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const MonthAtGlanceWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

        // 1. Total spend this month (general expenses)
        const analysis = await localGeneralExpenses.analysis.get(year)
        const monthData = analysis.monthly_summary.find((m) => m.month === month)
        const generalSpend = monthData?.actual_total || 0

        // 2. Payroll this month
        const { items } = await localEmployees.list({ pageSize: 9999 })
        const employees = items.filter((e) => e.status === 'Active')
        const payroll = employees.reduce((s, e) => s + parseFloat(e.current_salary || 0), 0)

        // 3. Total spend including project pool amounts (from consolidated sheet logic)
        const allProjects = await localProjects.dashboardList()
        let projectMonthlyBudget = 0
        const curYm = `${year}-${String(month).padStart(2, '0')}`
        allProjects.forEach((p) => {
          const entry = p.monthly_plan?.find((m) => m.month === curYm)
          if (entry) projectMonthlyBudget += entry.total || 0
        })

        const totalSpend = generalSpend + payroll + projectMonthlyBudget
        const activeProjects = allProjects.filter((p) => p.status === 'ongoing').length

        if (!cancelled) {
          setData({
            monthLabel,
            totalSpend,
            payroll,
            generalSpend,
            activeProjects,
            projectMonthlyBudget,
          })
        }
      } catch (err) {
        console.warn('MonthAtGlanceWidget failed to load data:', err.message || err)
        // If it fails (e.g. JWT clock skew), we can either leave it loading or show 0s.
        // We'll just leave it as null to hide the widget, or you could set fallback data here.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <WidgetCard
      icon={cilCalendar}
      label={`This Month at a Glance – ${data.monthLabel}`}
      stats={[
        {
          label: 'Total Spent (all expenses)',
          value: data.totalSpend,
          color: 'var(--cui-primary)',
        },
        {
          label: 'Payroll (salaries paid)',
          value: data.payroll,
          color: 'var(--cui-accent)',
        },
        {
          label: 'Active Projects (on ground)',
          value: data.activeProjects,
          color: 'var(--cui-body-color)',
        },
      ]}
    />
  )
}

export default MonthAtGlanceWidget
