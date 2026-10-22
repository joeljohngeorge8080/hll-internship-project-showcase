// src/modules/ems/expense-management/PaymentsPage.jsx
// Quick redirects to the billing area of the software HMA pays for. Claude
// and Supabase are plain external links (billed through an existing org
// login). AWS is different — HR signs in as a dedicated billing-only IAM
// user, so that login is stored (admin/hr only, see paymentCredentials.js)
// and shown here instead of just linked out to.
import React, { useEffect, useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CFormInput,
  CFormLabel,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CModalTitle,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilExternalLink, cilLowVision, cilCopy, cilPencil, cilCreditCard } from '@coreui/icons'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { paymentCredentials } from '../../../services/paymentCredentials'
import { getAwsSigninUrl } from '../../../services/awsBilling'

const openExternal = (url) => window.open(url, '_blank', 'noopener,noreferrer')

const EMPTY_FORM = { login_url: '', username: '', password: '', notes: '' }

const AWS_BUTTONS = [
  { destination: 'home', label: 'Sign in to AWS' },
  { destination: 'bills', label: 'View Bills' },
  { destination: 'payments_due', label: 'Payments Due' },
]

// A tile for a service that's just a static "open billing page" link — no
// credential to manage, so no fetch, no edit state.
const LinkOnlyCard = ({ title, description, url }) => (
  <CCard className="h-100">
    <CCardHeader className="fw-semibold">{title}</CCardHeader>
    <CCardBody className="d-flex flex-column">
      <p className="text-body-secondary small flex-grow-1">{description}</p>
      <CButton color="primary" variant="outline" onClick={() => openExternal(url)}>
        <CIcon icon={cilExternalLink} className="me-1" />
        Open Billing
      </CButton>
    </CCardBody>
  </CCard>
)

// Non-HR/Admin viewers get the tab but not the AWS credential — RLS would
// return nothing for them anyway, so this skips the fetch entirely rather
// than rendering a confusing empty state.
const AwsRestrictedCard = () => (
  <CCard className="h-100">
    <CCardHeader className="fw-semibold">AWS</CCardHeader>
    <CCardBody>
      <p className="text-body-secondary small mb-0">
        AWS billing access is managed by HR/Admin. Contact HR if you need the console link.
      </p>
    </CCardBody>
  </CCard>
)

const AwsManagedCard = () => {
  const [cred, setCred] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const row = await paymentCredentials.get('aws')
      setCred(row)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  const openEdit = () => {
    setForm({
      login_url: cred?.login_url || '',
      username: cred?.username || '',
      password: cred?.password || '',
      notes: cred?.notes || '',
    })
    setError('')
    setEditOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await paymentCredentials.upsert('aws', form)
      setEditOpen(false)
      setShowPassword(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const copyPassword = () => {
    if (cred?.password) navigator.clipboard?.writeText(cred.password)
  }

  // Opens a new tab immediately (so the browser doesn't treat it as a
  // Opens the tab only once the real URL is known — some browsers (Brave
  // included) silently fail to navigate a pre-opened blank tab once its
  // opener runs an async gap. If the browser's popup blocker catches this
  // (since it fires after an await, not synchronously from the click), we
  // surface that explicitly rather than leaving a mystery blank tab.
  const handleAwsSignin = async (destination) => {
    setSigningIn(destination)
    setError('')
    try {
      const url = await getAwsSigninUrl(destination)
      const win = window.open(url, '_blank', 'noreferrer')
      if (!win || win.closed || typeof win.closed === 'undefined') {
        setError('Your browser blocked the popup. Allow popups for this site and try again.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSigningIn('')
    }
  }

  return (
    <>
      <CCard className="h-100">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span className="fw-semibold">AWS</span>
          <CButton color="secondary" variant="ghost" size="sm" onClick={openEdit}>
            <CIcon icon={cilPencil} className="me-1" />
            {cred ? 'Edit' : 'Set Up'}
          </CButton>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : !cred ? (
            <p className="text-body-secondary small mb-0">
              No AWS billing login saved yet. Click &ldquo;Set Up&rdquo; to add the sign-in link and
              the billing-only IAM user&rsquo;s credentials.
            </p>
          ) : (
            <>
              {error && (
                <CAlert color="danger" className="small py-2">
                  {error}
                </CAlert>
              )}
              <div className="d-flex flex-column gap-2 mb-3">
                {AWS_BUTTONS.map(({ destination, label }) => (
                  <CButton
                    key={destination}
                    color={destination === 'home' ? 'primary' : 'secondary'}
                    variant="outline"
                    size="sm"
                    disabled={!!signingIn}
                    onClick={() => handleAwsSignin(destination)}
                  >
                    {signingIn === destination ? (
                      <CSpinner size="sm" className="me-1" />
                    ) : (
                      <CIcon icon={cilExternalLink} className="me-1" />
                    )}
                    {label}
                  </CButton>
                ))}
              </div>
              <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                Signs you in as the billing-only IAM user automatically — no password needed.
              </div>
              <div className="small mb-2">
                <span className="text-body-secondary">Username: </span>
                <span className="fw-medium">{cred.username || '—'}</span>
              </div>
              <div className="small d-flex align-items-center gap-2">
                <span className="text-body-secondary">Password: </span>
                <span className="fw-medium text-monospace">
                  {cred.password ? (showPassword ? cred.password : '••••••••') : '—'}
                </span>
                {cred.password && (
                  <>
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      <CIcon icon={cilLowVision} style={{ width: 14, height: 14 }} />
                    </CButton>
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      title="Copy password"
                      onClick={copyPassword}
                    >
                      <CIcon icon={cilCopy} style={{ width: 14, height: 14 }} />
                    </CButton>
                  </>
                )}
              </div>
              {cred.notes && <div className="text-body-secondary small mt-2">{cred.notes}</div>}
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={editOpen} onClose={() => setEditOpen(false)} alignment="center">
        <CModalHeader closeButton>
          <CModalTitle style={{ fontSize: '0.95rem' }}>AWS Billing Login</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" className="small py-2">
              {error}
            </CAlert>
          )}
          <div className="mb-3">
            <CFormLabel className="small fw-semibold">Sign-in URL</CFormLabel>
            <CFormInput
              placeholder="https://<account>.signin.aws.amazon.com/console"
              value={form.login_url}
              onChange={(e) => setForm((f) => ({ ...f, login_url: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <CFormLabel className="small fw-semibold">IAM Username</CFormLabel>
            <CFormInput
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <CFormLabel className="small fw-semibold">Password</CFormLabel>
            <CFormInput
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <CFormLabel className="small fw-semibold">Notes (optional)</CFormLabel>
            <CFormInput
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setEditOpen(false)}>
            Cancel
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={saving}>
            {saving && <CSpinner size="sm" className="me-1" />}
            Save
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

const PaymentsPage = () => {
  const canEdit = usePermission(MODULE.EXPENSE_MANAGEMENT, 'edit')

  return (
    <>
      <div className="mb-4">
        <h6 className="fw-bold mb-0">
          <CIcon icon={cilCreditCard} className="me-1" />
          Software Payments
        </h6>
        <div className="text-body-secondary small">
          Quick links to the billing area for the software HMA pays for.
        </div>
      </div>
      <CRow className="g-3">
        <CCol md={4}>
          <LinkOnlyCard
            title="Claude"
            description="Anthropic Console — usage and billing for Claude."
            url="https://console.anthropic.com/settings/billing"
          />
        </CCol>
        <CCol md={4}>
          <LinkOnlyCard
            title="Supabase"
            description="Supabase dashboard — organization billing and usage."
            url="https://supabase.com/dashboard/org/_/billing"
          />
        </CCol>
        <CCol md={4}>{canEdit ? <AwsManagedCard /> : <AwsRestrictedCard />}</CCol>
      </CRow>
    </>
  )
}

export default PaymentsPage
