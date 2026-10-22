import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilLowVision, cilUser } from '@coreui/icons'

import { loginWithGoogle } from '../../../services/auth'
import { verifyPasswordLogin } from '../../../services/localUsers'
import api from '../../../services/api'
import supabase from '../../../services/supabase'
import { localAudit } from '../../../services/localAudit'
import { roleDisplayName } from '../../../constants/roles'
import DomeGallery from './DomeGallery'
import hmaLogo from '../../../assets/brand/hma-logo.png'

const LOGIN_GALLERY_IMAGES = Array.from(
  { length: 24 },
  (_, i) => `/login-gallery/login-${String(i + 1).padStart(2, '0')}.jpg`,
)

const Login = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loadingPass, setLoadingPass] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/select-system'

  const storeSession = (data) => {
    localStorage.setItem('hma_token', data.access_token)
    dispatch({ type: 'set', user: data.user, token: data.access_token })
    
    localAudit.write({
      module: 'Auth',
      action: 'USER_LOGIN',
      record_id: data.user.employee_id || '',
      record_label: data.user.full_name || data.user.name || '',
      details: `${data.user.full_name || data.user.employee_id} logged in as ${roleDisplayName(data.user.role)}`,
    })

    navigate(from, { replace: true })
  }

  // ── Password login ──────────────────────────────────────────────────────────

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoadingPass(true)
    try {
      // Check local seeded accounts first — works without a backend account
      const localUser = verifyPasswordLogin(employeeId, password)
      if (localUser) {
        const token = `local-${Date.now()}`
        localStorage.setItem('hma_token', token)
        localStorage.setItem('hma_local_user', JSON.stringify(localUser))
        // Establish a real Supabase session so RLS (which checks auth.uid()) has
        // something to authorize against — awaited so the app doesn't navigate
        // to a page that queries Supabase before the session exists (RLS would
        // then block everything and the page would render empty). Seeded
        // dev/demo accounts only for now — failure here doesn't block login,
        // since not every account is seeded yet.
        if (localUser.google_email) {
          await supabase.auth
            .signInWithPassword({ email: localUser.google_email, password })
            .catch(() => { })
        }
        dispatch({ type: 'set', user: localUser, token })
        
        localAudit.write({
          module: 'Auth',
          action: 'USER_LOGIN',
          record_id: localUser.employee_id || '',
          record_label: localUser.full_name || localUser.name || '',
          details: `${localUser.full_name || localUser.employee_id} logged in as ${roleDisplayName(localUser.role)}`,
        })

        navigate(from, { replace: true })
        return
      }
      const { data } = await api.post('/auth/login', { employee_id: employeeId, password })
      storeSession(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid employee ID or password.')
    } finally {
      setLoadingPass(false)
    }
  }

  // ── Google login ────────────────────────────────────────────────────────────

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('')
    setLoadingGoogle(true)
    try {
      const { data } = await loginWithGoogle(credentialResponse.credential)

      // Establish a real Supabase session from the same Google credential so
      // RLS (which checks auth.uid()) has something to authorize against —
      // mirrors the password/dev login paths above. Isolated in its own
      // try/catch (separate from the backend login above) so a Supabase-side
      // failure degrades to a warning instead of blocking login entirely —
      // the backend call already proved the account is valid.
      try {
        const { error: supabaseAuthError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: credentialResponse.credential,
        })
        if (!supabaseAuthError) {
          // Refreshes `profiles` from the `users` allow-list HR maintains, so
          // the JWT role claim RLS reads reflects the latest granted role.
          try {
            await supabase.rpc('sync_my_profile')
          } catch (syncErr) {
            console.warn('[Login] Profile sync failed:', syncErr)
          }
        } else {
          console.warn('[Login] Supabase sign-in failed — RLS reads will be empty:', supabaseAuthError)
        }
      } catch (supabaseErr) {
        console.warn('[Login] Supabase sign-in threw — RLS reads will be empty:', supabaseErr)
      }

      storeSession(data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Google login failed. Your account may not be registered — contact HR.',
      )
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.')
  }

  // ── Dev quick-login ─────────────────────────────────────────────────────────

  const [devLoginKey, setDevLoginKey] = useState('')

  const handleDevLogin = async (key, user, redirect, devPassword) => {
    setDevLoginKey(key)
    const devToken = `dev-token-${key}`
    // Dev sessions are in-memory only — don't persist to localStorage so the
    // app always starts at login on page reload. The Supabase sign-in is
    // awaited (not fired-and-forgotten) so the target page's queries don't
    // run before the session exists — RLS blocks unauthenticated reads
    // entirely, which made pages render empty on a race.
    if (devPassword && user.google_email) {
      await supabase.auth
        .signInWithPassword({ email: user.google_email, password: devPassword })
        .catch((err) =>
          console.warn(
            `[DevLogin] Supabase sign-in failed for ${user.google_email} — RLS writes will be ` +
            `rejected for the rest of this session:`,
            err?.message,
          ),
        )
    }
    dispatch({ type: 'set', user, token: devToken })
    
    localAudit.write({
      module: 'Auth',
      action: 'USER_LOGIN',
      record_id: user.employee_id || '',
      record_label: user.full_name || user.name || '',
      details: `${user.full_name || user.employee_id} logged in as ${roleDisplayName(user.role)}`,
    })

    navigate(redirect || '/select-system')
    setDevLoginKey('')
  }

  const isLoading = loadingPass || loadingGoogle

  return (
    <div
      data-coreui-theme="light"
      style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}
    >
      {/* ── Dome gallery background (auto-rotating, non-interactive) ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#120F17' }}>
        <DomeGallery
          images={LOGIN_GALLERY_IMAGES}
          fit={0.6}
          minRadius={300}
          tiltDeg={3}
          segments={24}
          autoRotateSpeed={3}
          grayscale={false}
          pushBack={1200}
        />
      </div>

      {/* ── Login card ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={5} lg={4}>
              <CCard className="hma-login-card p-4">
                <CCardBody>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <img src={hmaLogo} alt="HMA" style={{ height: 28, objectFit: 'contain' }} />
                    <h2 className="fw-bold mb-0" style={{ fontSize: '1.375rem' }}>
                      HMA IEMS
                    </h2>
                  </div>
                  <p className="text-body-secondary mb-4" style={{ fontSize: '0.8125rem' }}>
                    Internal Enterprise Management System
                  </p>

                  {error && (
                    <CAlert
                      color="danger"
                      dismissible
                      onClose={() => setError('')}
                      className="mb-3"
                    >
                      {error}
                    </CAlert>
                  )}

                  {/* ── Employee ID + Password ── */}
                  <CForm onSubmit={handlePasswordLogin}>
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        placeholder="Employee ID"
                        autoComplete="username"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </CInputGroup>

                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        className="input-group-text"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        disabled={isLoading}
                        style={{
                          cursor: 'pointer',
                          opacity: showPassword ? 1 : 0.55,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <CIcon icon={cilLowVision} />
                      </button>
                    </CInputGroup>

                    <div className="d-grid mb-3">
                      <CButton color="primary" type="submit" disabled={isLoading}>
                        {loadingPass && <CSpinner size="sm" className="me-2" />}
                        Login
                      </CButton>
                    </div>
                  </CForm>

                  {/* ── Divider ── */}
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <hr className="flex-grow-1 my-0" />
                    <span className="text-body-secondary small">or</span>
                    <hr className="flex-grow-1 my-0" />
                  </div>

                  {/* ── Google Sign-In ── */}
                  {loadingGoogle ? (
                    <div className="d-flex align-items-center justify-content-center gap-2 py-1">
                      <CSpinner size="sm" />
                      <span className="text-body-secondary small">Signing in with Google…</span>
                    </div>
                  ) : (
                    <div className="d-flex justify-content-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        useOneTap={false}
                        theme="outline"
                        size="large"
                        text="signin_with"
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  {/* ── Dev shortcuts ── */}
                  {import.meta.env.DEV && (
                    <>
                      <hr className="mt-4" />
                      <p className="text-body-secondary small mb-2">Dev quick-login</p>
                      <div className="d-grid gap-2">
                        {[
                          {
                            label: 'Admin',
                            role: 'Admin',
                            id: 'DEV000',
                            name: 'Dev Admin',
                            googleEmail: 'dev000@hma.dev',
                            devPassword: 'Demo-Dev-000',
                          },
                          {
                            label: 'CEO',
                            role: 'CEO',
                            id: 'DEV001',
                            name: 'Dev CEO',
                            googleEmail: 'dev001@hma.dev',
                            devPassword: 'Demo-Dev-001',
                          },
                          {
                            label: 'Finance',
                            role: 'Heads',
                            id: 'DEV002',
                            name: 'Dev Head',
                            googleEmail: 'dev002@hma.dev',
                            devPassword: 'Demo-Dev-002',
                          },
                          {
                            label: 'HR',
                            role: 'HR',
                            id: 'DEV003',
                            name: 'Dev HR',
                            googleEmail: 'dev003@hma.dev',
                            devPassword: 'Demo-Dev-003',
                          },
                          {
                            label: 'Project Coordinator',
                            role: 'Project Coordinator',
                            id: 'DEV_PC_001',
                            name: 'Maya Krishnan (PC)',
                            employeeId: 'EMP005',
                            redirect: '/pms/pa/dashboard',
                            googleEmail: 'pc1@hma.dev',
                            devPassword: 'Demo-PC-1',
                          },
                          {
                            label: 'PA (Community Development)',
                            role: 'Project Associate',
                            id: 'DEV_PA_001',
                            name: 'Rahul Menon (PA)',
                            employeeId: 'EMP2707',
                            redirect: '/pms/pa/dashboard',
                            googleEmail: 'pa1@hma.dev',
                            devPassword: 'Demo-PA-1',
                          },
                          {
                            label: 'PA (Public Health)',
                            role: 'Project Associate',
                            id: 'DEV_PA_002',
                            name: 'Anil Varghese (PA)',
                            employeeId: 'EMP3351',
                            redirect: '/pms/pa/dashboard',
                            googleEmail: 'pa2@hma.dev',
                            devPassword: 'Demo-PA-2',
                          },
                          {
                            label: 'Project Officer',
                            role: 'Project Officer',
                            id: 'DEV005',
                            name: 'Dev Project Officer',
                            googleEmail: 'dev005@hma.dev',
                            devPassword: 'Demo-Dev-005',
                          },
                          {
                            label: 'Employee',
                            role: 'Employee',
                            id: 'DEV009',
                            name: 'Tina Joseph',
                            employeeId: 'EMP2408',
                            googleEmail: 'dev009@hma.dev',
                            devPassword: 'Demo-Dev-009',
                          },
                        ].map(
                          ({
                            label,
                            id,
                            role,
                            name,
                            redirect,
                            employeeId,
                            googleEmail,
                            devPassword,
                          }) => (
                            <CButton
                              key={id}
                              color="secondary"
                              variant="outline"
                              size="sm"
                              type="button"
                              disabled={devLoginKey !== ''}
                              onClick={() =>
                                handleDevLogin(
                                  id,
                                  {
                                    employee_id: employeeId || id,
                                    full_name: name,
                                    role,
                                    google_email: googleEmail,
                                  },
                                  redirect,
                                  devPassword,
                                )
                              }
                            >
                              {devLoginKey === id ? <CSpinner size="sm" /> : label}
                            </CButton>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    </div>
  )
}

export default Login
