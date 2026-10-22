import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilFolder,
  cilSync,
  cilDollar,
  cilFile,
  cilPeople,
  cilLocationPin,
  cilCash,
  cilChartPie,
  cilBuilding,
  cilListRich,
  cilTransfer,
  cilBriefcase,
  cilTask,
  cilGroup,
  cilChatBubble,
} from '@coreui/icons'
import { CNavGroup, CNavItem } from '@coreui/react'

const pmsNav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/pms/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'AI Assistant',
    to: '/pms/ai-chat',
    icon: <CIcon icon={cilChatBubble} customClassName="nav-icon" />,
  },
  // ── Project Coordinator section (oversees both PA specializations; doesn't own projects) ──
  {
    component: CNavGroup,
    name: 'Project Coordinator',
    icon: <CIcon icon={cilBriefcase} customClassName="nav-icon" />,
    badge: { color: 'primary', text: 'PC' },
    items: [
      { component: CNavItem, name: 'PC Dashboard', to: '/pms/pa/dashboard' },
      { component: CNavItem, name: 'All Projects', to: '/pms/projects' },
      { component: CNavItem, name: 'Project Officers', to: '/pms/project-teams/officers' },
      { component: CNavItem, name: 'Team Overview', to: '/pms/pa/team-overview' },
      { component: CNavItem, name: 'Donor Records', to: '/pms/funding-agencies' },
      { component: CNavItem, name: 'Beneficiary Records', to: '/pms/beneficiary' },
    ],
  },
  // ── Project Associate section (scoped to the PA's own fixed specialization) ──
  {
    component: CNavGroup,
    name: 'Project Associate',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    badge: { color: 'secondary', text: 'PA' },
    items: [
      { component: CNavItem, name: 'PA Dashboard', to: '/pms/pa/dashboard' },
      { component: CNavItem, name: 'All Projects', to: '/pms/projects' },
      { component: CNavItem, name: 'Create Project', to: '/pms/projects/create' },
      { component: CNavItem, name: 'Project Officers', to: '/pms/project-teams/officers' },
      { component: CNavItem, name: 'Team Overview', to: '/pms/pa/team-overview' },
      { component: CNavItem, name: 'Donor Records', to: '/pms/funding-agencies' },
      { component: CNavItem, name: 'Beneficiary Records', to: '/pms/beneficiary' },
      { component: CNavItem, name: 'LSGB Projects', to: '/pms/lsgb' },
    ],
  },
  {
    component: CNavGroup,
    name: 'Projects',
    icon: <CIcon icon={cilFolder} customClassName="nav-icon" />,
    items: [
      { component: CNavItem, name: 'My Projects', to: '/pms/projects/my-projects' },
      { component: CNavItem, name: 'Create Project', to: '/pms/projects/create' },
      { component: CNavItem, name: 'All Projects', to: '/pms/projects' },
      { component: CNavItem, name: 'Archive', to: '/pms/projects/archive' },
    ],
  },
  {
    component: CNavGroup,
    name: 'Project Lifecycle',
    icon: <CIcon icon={cilSync} customClassName="nav-icon" />,
    items: [
      { component: CNavItem, name: 'Pipeline', to: '/pms/projects?status=pipeline' },
      { component: CNavItem, name: 'Design Phase', to: '/pms/projects?status=approved' },
      { component: CNavItem, name: 'Implementation', to: '/pms/projects?status=ongoing' },
      { component: CNavItem, name: 'Follow-up', to: '/pms/projects?status=ongoing' },
      { component: CNavItem, name: 'Completed', to: '/pms/projects?status=completed' },
    ],
  },

  {
    component: CNavItem,
    name: 'Donor Records',
    to: '/pms/funding-agencies',
    icon: <CIcon icon={cilBuilding} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Beneficiary Records',
    to: '/pms/beneficiary',
    icon: <CIcon icon={cilGroup} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Audit Logs',
    to: '/pms/audit-logs',
    icon: <CIcon icon={cilListRich} customClassName="nav-icon" />,
  },

  {
    component: CNavItem,
    name: 'Switch to EMS',
    to: '/select-system',
    icon: <CIcon icon={cilTransfer} customClassName="nav-icon" />,
  },
]

export default pmsNav
