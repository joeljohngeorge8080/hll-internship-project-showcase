import React, { Suspense, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

import useAuth from './hooks/useAuth'
import { getMeApi } from './services/auth'
import { localAudit } from './services/localAudit'
import { roleDisplayName, directSystemRouteForRole } from './constants/roles'
import store from './store'

// Register the Redux state getter once at module load — this lets service-layer
// functions call localAudit.write() without importing the store directly
// (which would create circular dependency chains).
localAudit.setUserGetter(() => store.getState())

const EmsLayout = React.lazy(() => import('./layout/EmsLayout'))
const PmsLayout = React.lazy(() => import('./layout/PmsLayout'))
const Login = React.lazy(() => import('./views/pages/login/Login'))
const SystemSelection = React.lazy(() => import('./views/pages/system-selection/SystemSelection'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const directSystemRoute = isAuthenticated ? directSystemRouteForRole(user?.role) : null

  return (
    <Routes>
      <Route
        exact
        path="/login"
        name="Login Page"
        element={
          isAuthenticated ? (
            <Navigate to={directSystemRoute || '/select-system'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route exact path="/404" name="Page 404" element={<Page404 />} />
      <Route exact path="/500" name="Page 500" element={<Page500 />} />
      <Route
        exact
        path="/select-system"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" state={{ from: location }} replace />
          ) : directSystemRoute ? (
            <Navigate to={directSystemRoute} replace />
          ) : (
            <SystemSelection />
          )
        }
      />
      <Route
        path="/ems/*"
        element={
          isAuthenticated ? (
            <EmsLayout />
          ) : (
            <Navigate to="/login" state={{ from: location }} replace />
          )
        }
      />
      <Route
        path="/pms/*"
        element={
          isAuthenticated ? (
            <PmsLayout />
          ) : (
            <Navigate to="/login" state={{ from: location }} replace />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={isAuthenticated ? directSystemRoute || '/select-system' : '/login'}
            replace
          />
        }
      />
    </Routes>
  )
}

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)
  const token = useSelector((state) => state.token)
  const dispatch = useDispatch()
  const [isInitializing, setIsInitializing] = useState(() => Boolean(token))

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    if (theme) {
      setColorMode(theme)
    }
    if (isColorModeSet()) {
      return
    }
    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return

    // Dev tokens are in-memory only — they must not survive a page reload.
    // Clear any stale dev token so the user is always routed to login on refresh.
    if (token.startsWith('dev-')) {
      localStorage.removeItem('hma_token')
      localStorage.removeItem('hma_dev_user')
      dispatch({ type: 'set', user: null, token: null })
      setIsInitializing(false) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    getMeApi()
      .then(({ data }) => {
        dispatch({ type: 'set', user: data })
        // Log session rehydration as a login event
        localAudit.write({
          module: 'Auth',
          action: 'USER_LOGIN',
          record_id: data?.employee_id || '',
          record_label: data?.full_name || data?.name || '',
          details: `${data?.full_name || data?.employee_id} logged in as ${roleDisplayName(data?.role)}`,
        })
      })
      .catch(() => {
        localStorage.removeItem('hma_token')
        dispatch({ type: 'set', user: null, token: null })
      })
      .finally(() => setIsInitializing(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isInitializing) {
    return (
      <div className="pt-3 text-center">
        <CSpinner color="primary" variant="grow" />
      </div>
    )
  }

  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <AppRoutes />
      </Suspense>
    </HashRouter>
  )
}

export default App
