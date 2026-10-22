import React, { useState } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSettings } from '@coreui/icons'

import useDashboardWidgets from '../../../components/dashboard/useDashboardWidgets'
import DashboardGrid from '../../../components/dashboard/DashboardGrid'
import WidgetCatalog from '../../../components/dashboard/WidgetCatalog'

import ProjectKPIsWidget from './widgets/ProjectKPIsWidget'
import ProjectValueWidget from './widgets/ProjectValueWidget'
import DailyReportsSummaryWidget from './widgets/DailyReportsSummaryWidget'
import FieldPersonnelWidget from './widgets/FieldPersonnelWidget'
import SettlementsWidget from './widgets/SettlementsWidget'
import ProjectsByPhaseWidget from './widgets/ProjectsByPhaseWidget'
import RecentProjectsWidget from './widgets/RecentProjectsWidget'

const ALL_WIDGETS = [
  {
    id: 'project_kpis',
    title: 'Project Pipeline',
    description: 'Pipeline / Approved / Ongoing / Completed project counts',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Projects', color: 'primary' },
    component: ProjectKPIsWidget,
  },
  {
    id: 'project_value',
    title: 'Portfolio Financials',
    description: 'Total project value, amount received, utilisation %, breakdown by type',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Finance', color: 'success' },
    component: ProjectValueWidget,
  },
  {
    id: 'daily_reports',
    title: 'Daily Reports',
    description: 'Pending, approved, declined, and settled report counts',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Reports', color: 'warning' },
    component: DailyReportsSummaryWidget,
  },
  {
    id: 'field_personnel',
    title: 'Field Personnel',
    description: 'Active personnel, task counts, completion rate',
    colProps: { xs: 12, sm: 6, xl: 3 },
    badge: { label: 'Teams', color: 'info' },
    component: FieldPersonnelWidget,
  },
  {
    id: 'settlements',
    title: 'Settlements',
    description: 'Pending vs settled reports and financial amounts',
    colProps: { xs: 12, sm: 6, lg: 4 },
    badge: { label: 'Finance', color: 'success' },
    component: SettlementsWidget,
  },
  {
    id: 'projects_by_phase',
    title: 'Projects by Phase & Status',
    description: 'Lifecycle phase breakdown and status distribution',
    colProps: { xs: 12, sm: 6, lg: 4 },
    badge: { label: 'Projects', color: 'primary' },
    component: ProjectsByPhaseWidget,
  },
  {
    id: 'recent_projects',
    title: 'Recent Projects',
    description: 'Latest 6 projects with value, progress, and status',
    colProps: { xs: 12, lg: 8 },
    badge: { label: 'Projects', color: 'primary' },
    component: RecentProjectsWidget,
  },
]

const PmsDashboard = () => {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const { activeIds, activeWidgets, toggleWidget, resetWidgets } = useDashboardWidgets(
    'pms',
    ALL_WIDGETS,
  )

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">Projects Dashboard</h4>
          <p className="text-body-secondary mb-0 small">
            {activeWidgets.length} of {ALL_WIDGETS.length} widgets active
          </p>
        </div>
        <CButton color="secondary" variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
          <CIcon icon={cilSettings} className="me-1" size="sm" />
          Customize
        </CButton>
      </div>

      <DashboardGrid activeWidgets={activeWidgets} />

      <WidgetCatalog
        visible={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        allWidgets={ALL_WIDGETS}
        activeIds={activeIds}
        onToggle={toggleWidget}
        onReset={resetWidgets}
      />
    </>
  )
}

export default PmsDashboard
