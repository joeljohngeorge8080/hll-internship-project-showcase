import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilPeople,
  cilCalendar,
  cilMoney,
  cilCash,
  cilChartPie,
  cilListRich,
  cilTransfer,
  cilTags,
  cilUser,
  cilSettings,
  cilBell,
  cilNotes,
  cilOptions,
  cilCalculator,
  cilCloudUpload,
  cilChatBubble,
  cilChartLine,
} from '@coreui/icons'
import { CNavGroup, CNavItem } from '@coreui/react'

import { ROLE, ROLES } from '../../constants/roles'

const STAFF_ROLES = [ROLE.ADMIN, ROLE.CEO, ROLE.HEADS, ROLE.HR]
// Project Coordinator and Project Associate get the "common" EMS tabs
// (Dashboard, Reports & Analysis, Expense Management, Audit Logs) but not
// HR Admin or Finance — kept as a separate list so those two groups
// (derived from STAFF_ROLES via .filter()) never inherit it.
const EMS_COMMON_ROLES = [...STAFF_ROLES, ROLE.PROJECT_COORDINATOR, ROLE.PROJECT_ASSOCIATE]
// Forecast is open to PMS field/project roles too — mirrors MODULE.FORECAST
// permissions (permissions.js), unlike Reports/Expense Management above.
const FORECAST_ROLES = [
  ROLE.ADMIN,
  ROLE.CEO,
  ROLE.HEADS,
  ROLE.HR,
  ROLE.PROJECT_COORDINATOR,
  ROLE.PROJECT_ASSOCIATE,
  ROLE.PROJECT_OFFICER,
]

const emsNav = [
  {
    component: CNavItem,
    name: 'My Profile',
    to: '/ems/my-profile',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
    roles: [ROLE.EMPLOYEE],
  },
  {
    component: CNavItem,
    name: 'AI Assistant',
    to: '/ems/ai-chat',
    icon: <CIcon icon={cilChatBubble} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/ems/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    roles: EMS_COMMON_ROLES,
  },

  // ── HR Admin group ─────────────────────────────────────────────────
  // Heads/Finance role is excluded from HR Admin.
  {
    component: CNavGroup,
    name: 'HR Admin',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    roles: STAFF_ROLES.filter((r) => r !== ROLE.HEADS),
    items: [
      {
        component: CNavGroup,
        name: 'Staff & Payroll',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
        items: [
          {
            component: CNavItem,
            name: 'Staff List',
            to: '/ems/staff-payroll',
          },
          {
            component: CNavItem,
            name: 'Salary Details',
            to: '/ems/staff-payroll/salary-invoice',
            icon: <CIcon icon={cilCalculator} customClassName="nav-icon" />,
          },
        ],
      },
      {
        component: CNavGroup,
        name: 'Attendance',
        icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
        items: [
          { component: CNavItem, name: 'Overview', to: '/ems/attendance' },
          { component: CNavItem, name: 'Import Excel', to: '/ems/attendance/import' },
          { component: CNavItem, name: 'Corrections', to: '/ems/attendance/corrections' },
        ],
      },
      {
        component: CNavGroup,
        name: 'Activity',
        items: [
          { component: CNavItem, name: 'Internship', to: '/ems/internship' },
          { component: CNavItem, name: 'Recruitment & Training', to: '/ems/recruitment' },
        ],
      },
      {
        component: CNavItem,
        name: 'Expense Booking',
        to: '/ems/hr-pool/global',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Upload GST Bill',
        to: '/ems/hr-admin/upload-gst-bill',
        icon: <CIcon icon={cilCloudUpload} customClassName="nav-icon" />,
      },
      {
        component: CNavGroup,
        name: 'General Expenses',
        icon: <CIcon icon={cilCash} customClassName="nav-icon" />,
        items: [
          { component: CNavItem, name: 'Divisions', to: '/ems/general-expenses' },
          {
            component: CNavItem,
            name: 'Categories',
            to: '/ems/general-expenses/categories',
            icon: <CIcon icon={cilTags} customClassName="nav-icon" />,
          },
        ],
      },
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────
  // HR role is excluded from Finance.
  {
    component: CNavGroup,
    name: 'Finance',
    icon: <CIcon icon={cilCalculator} customClassName="nav-icon" />,
    roles: STAFF_ROLES.filter((r) => r !== ROLE.HR),
    items: [
      { component: CNavItem, name: 'GST Bills', to: '/ems/finance/gst-bills' },
      { component: CNavItem, name: 'GST 2B Comparison', to: '/ems/finance/gst-2b-comparison' },
      { component: CNavItem, name: 'Files', to: '/ems/finance/files' },
      { component: CNavItem, name: 'LSGB', to: '/ems/finance/lsgb' },
    ],
  },

  // ── User Management (Admin + HR) ───────────────────────────────────
  {
    component: CNavGroup,
    name: 'User Management',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    roles: [ROLE.ADMIN, ROLE.HR, ROLE.PROJECT_COORDINATOR, ROLE.PROJECT_ASSOCIATE],
    items: [
      { component: CNavItem, name: 'Registered Users', to: '/ems/user-management' },
      { component: CNavItem, name: 'Add User', to: '/ems/user-management/add' },
    ],
  },
  {
    component: CNavGroup,
    name: 'Reports & Analysis',
    icon: <CIcon icon={cilChartPie} customClassName="nav-icon" />,
    roles: EMS_COMMON_ROLES,
    items: [
      { component: CNavItem, name: 'Visual Model', to: '/ems/reports-analysis/visual-model' },
      {
        component: CNavItem,
        name: 'Detailed Report',
        to: '/ems/reports-analysis/detailed-report',
      },
      { component: CNavItem, name: 'Reports', to: '/ems/reports-analysis/reports' },
    ],
  },

  // ── Expense Management (moved out of HR Admin so Heads, who has VIEW
  // access per EXPENSE_MANAGEMENT permissions, can actually reach it) ─
  {
    component: CNavItem,
    name: 'Expense Management',
    to: '/ems/expense-management',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
    roles: EMS_COMMON_ROLES,
  },

  // ── Forecast (open to HR admin + PMS field/project roles) ──────────
  {
    component: CNavGroup,
    name: 'Forecast',
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
    roles: FORECAST_ROLES,
    items: [
      {
        component: CNavItem,
        name: 'Super Forecasting',
        to: '/ems/forecast/super-forecasting',
      },
      {
        component: CNavItem,
        name: 'Forecast Expense',
        to: '/ems/forecast/expense',
      },
    ],
  },

  {
    component: CNavItem,
    name: 'Audit Logs',
    to: '/ems/audit-logs',
    icon: <CIcon icon={cilListRich} customClassName="nav-icon" />,
    roles: EMS_COMMON_ROLES,
  },
  // ── Admin Settings (Admin only) ───────────────────────────────────────────
  {
    component: CNavItem,
    name: 'Admin Settings',
    to: '/ems/admin-settings',
    icon: <CIcon icon={cilOptions} customClassName="nav-icon" />,
    roles: [ROLE.ADMIN],
  },

  // ── CEO Announcements (CEO + Admin) ───────────────────────────────────────
  {
    component: CNavGroup,
    name: 'Announcements',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
    roles: [ROLE.CEO, ROLE.ADMIN],
    items: [
      {
        component: CNavItem,
        name: 'Personal Notes',
        to: '/ems/announcements',
        icon: <CIcon icon={cilNotes} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Compose & Send',
        to: '/ems/announcements/compose',
        icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Sent Messages',
        to: '/ems/announcements/sent',
        icon: <CIcon icon={cilListRich} customClassName="nav-icon" />,
      },
    ],
  },

  // ── Notifications inbox (non-CEO, non-Admin staff) ─────────────────────────
  {
    component: CNavItem,
    name: 'Notifications',
    to: '/ems/notifications',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
    roles: [
      ROLE.HEADS,
      ROLE.HR,
      ROLE.EMPLOYEE,
      ROLE.PROJECT_COORDINATOR,
      ROLE.PROJECT_ASSOCIATE,
      ROLE.PROJECT_OFFICER,
    ],
  },

  {
    component: CNavItem,
    name: 'Switch to PMS',
    to: '/select-system',
    icon: <CIcon icon={cilTransfer} customClassName="nav-icon" />,
  },
]

export default emsNav
