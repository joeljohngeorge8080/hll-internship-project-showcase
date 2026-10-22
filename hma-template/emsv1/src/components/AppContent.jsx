import React, { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

import { useRoutes } from '../contexts/RoutesContext'
import ProtectedRoute from './ProtectedRoute'
import useRole from '../hooks/useRole'
import { ROLE } from '../constants/roles'

/**
 * Converts an absolute route path to a relative one for use in nested <Routes>.
 *
 * EmsLayout is mounted at /ems/* and PmsLayout at /pms/*.
 * React Router v6 nested <Routes> must use paths relative to the parent match,
 * so we strip the /ems/ or /pms/ prefix from each path.
 *
 * Examples:
 *   /ems/dashboard          → dashboard
 *   /ems/staff-payroll/:id  → staff-payroll/:id
 *   /pms/projects/:id/edit  → projects/:id/edit
 *   /                       → / (unchanged — the catch-all home entry)
 */
const toRelativePath = (path) => {
  if (!path || path === '/') return path
  return path.replace(/^\/(ems|pms)\//, '')
}

const AppContent = () => {
  const routes = useRoutes()
  const { pathname } = useLocation()
  const role = useRole()

  // Role-aware default: PA and PO go to their dedicated dashboard,
  // everyone else goes to the generic system dashboard.
  const defaultDashboard = (() => {
    if (pathname.startsWith('/pms')) {
      if (role === ROLE.PROJECT_COORDINATOR || role === ROLE.PROJECT_ASSOCIATE || role === ROLE.PROJECT_OFFICER) {
        return '/pms/pa/dashboard'
      }
      return '/pms/dashboard'
    }
    if (role === ROLE.EMPLOYEE) return '/ems/my-profile'
    return '/ems/dashboard'
  })()

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            if (!route.element) return null
            const relativePath = toRelativePath(route.path)
            return (
              <Route
                key={idx}
                path={relativePath}
                exact={route.exact}
                name={route.name}
                element={
                  route.module ? (
                    <ProtectedRoute module={route.module}>
                      <route.element />
                    </ProtectedRoute>
                  ) : (
                    <route.element />
                  )
                }
              />
            )
          })}
          <Route path="*" element={<Navigate to={defaultDashboard} replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
