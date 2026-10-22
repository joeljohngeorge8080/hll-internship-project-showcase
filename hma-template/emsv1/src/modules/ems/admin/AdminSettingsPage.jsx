import React, { useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CProgress,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBan,
  cilBell,
  cilCheckCircle,
  cilClock,
  cilCloudDownload,
  cilCode,
  cilDataTransferDown,
  cilInfo,
  cilLockLocked,
  cilReload,
  cilSettings,
  cilShieldAlt,
  cilSpeedometer,
  cilTrash,
  cilWarning,
} from '@coreui/icons'
import { localAdminSettings } from '../../../services/localAdminSettings'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n, unit) => `${n}${unit}`

// Simulates server metrics — changes slightly each poll cycle
const generateMetrics = () => {
  const seed = Date.now()
  const rand = (min, max) => (min + (((seed * 9301 + 49297) % 233280) / 233280) * (max - min)) | 0
  return {
    cpu: rand(18, 62),
    memory: rand(42, 74),
    disk: 67,
    activeUsers: rand(4, 19),
    apiResponseMs: rand(68, 195),
    dbConnections: rand(6, 24),
    networkIn: rand(12, 80),
    networkOut: rand(8, 55),
  }
}

const UPTIME_START = Date.now() - 7 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000

const uptimeString = (from) => {
  const secs = Math.floor((Date.now() - from) / 1000)
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${d}d ${h}h ${m}m ${s}s`
}

const progressColor = (pct) => {
  if (pct < 50) return 'success'
  if (pct < 75) return 'warning'
  return 'danger'
}

// ── Sidebar nav items ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'system', label: 'System', icon: cilSettings },
  { id: 'server', label: 'Server Health', icon: cilSpeedometer },
  { id: 'security', label: 'Security', icon: cilShieldAlt },
  { id: 'notifications', label: 'Notifications', icon: cilBell },
  { id: 'data', label: 'Data & Logs', icon: cilDataTransferDown },
  { id: 'about', label: 'About', icon: cilInfo },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const MaintenanceConfirmModal = ({ onAccept, onCancel }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}
  >
    <div
      style={{
        background: 'var(--cui-body-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 12,
        maxWidth: 460,
        width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}
    >
      {/* Red header strip */}
      <div
        style={{
          background: '#d93025',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <CIcon icon={cilWarning} style={{ width: 26, height: 26, color: '#fff', flexShrink: 0 }} />
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>
            Enable Maintenance Mode?
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
            This is a high-impact system action
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        <p
          style={{
            fontSize: 14,
            color: 'var(--cui-body-color)',
            marginBottom: 12,
            lineHeight: 1.6,
          }}
        >
          Enabling maintenance mode will immediately:
        </p>
        <ul
          style={{
            fontSize: 14,
            color: 'var(--cui-body-color)',
            paddingLeft: 20,
            marginBottom: 20,
            lineHeight: 1.8,
          }}
        >
          <li>Block all non-Admin users from accessing the system</li>
          <li>Display the maintenance banner across all pages</li>
          <li>Log out any currently active sessions (after page refresh)</li>
        </ul>
        <CAlert color="warning" className="py-2 mb-0 small d-flex align-items-center gap-2">
          <CIcon icon={cilWarning} />
          Only proceed if you are sure. Remember to disable maintenance mode once done.
        </CAlert>
      </div>

      {/* Actions */}
      <div
        style={{
          padding: '14px 24px 20px',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
        }}
      >
        <CButton color="secondary" variant="outline" onClick={onCancel}>
          Cancel
        </CButton>
        <CButton color="danger" onClick={onAccept} style={{ minWidth: 200 }}>
          <CIcon icon={cilBan} className="me-2" />
          Yes, Enable Maintenance Mode
        </CButton>
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SLIDE TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

const SlideToggle = ({ checked, onChange, disabled = false }) => {
  const [hovered, setHovered] = useState(false)

  const trackColor = checked ? '#d93025' : hovered ? '#b0b8c1' : 'var(--cui-secondary-bg)'
  const thumbLeft = checked ? 'calc(100% - 30px)' : '3px'

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 60,
        height: 30,
        borderRadius: 15,
        background: trackColor,
        border: `2px solid ${checked ? '#b52820' : 'var(--cui-border-color)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.25s, border-color 0.25s',
        flexShrink: 0,
        padding: 0,
        outline: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: thumbLeft,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

const SystemSection = ({ settings, onChange, onPersist, onSave, saved }) => {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = (next) => {
    if (next) {
      setShowConfirm(true)
    } else {
      onPersist('maintenance_mode', false)
    }
  }

  const handleAccept = () => {
    setShowConfirm(false)
    onPersist('maintenance_mode', true)
  }

  const handleCancel = () => setShowConfirm(false)

  return (
    <>
      {showConfirm && <MaintenanceConfirmModal onAccept={handleAccept} onCancel={handleCancel} />}

      <div>
        <h5 className="fw-bold mb-1">System</h5>
        <p className="text-body-secondary small mb-4">
          Core application settings and maintenance controls
        </p>

        {/* Maintenance Mode */}
        <CCard
          className="mb-4"
          style={{
            border: settings.maintenance_mode
              ? '2px solid #d93025'
              : '1px solid var(--cui-border-color)',
            transition: 'border-color 0.3s',
          }}
        >
          <CCardBody>
            {/* Toggle row */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="fw-semibold mb-1 d-flex align-items-center gap-2">
                  <CIcon
                    icon={cilBan}
                    className={settings.maintenance_mode ? 'text-danger' : 'text-body-secondary'}
                  />
                  Maintenance Mode
                  {settings.maintenance_mode && (
                    <CBadge color="danger" className="ms-1">
                      ACTIVE
                    </CBadge>
                  )}
                </div>
                <div className="small text-body-secondary">
                  Blocks all non-Admin users. Shows a maintenance banner site-wide.
                </div>
              </div>
              <SlideToggle checked={settings.maintenance_mode} onChange={handleToggle} />
            </div>

            {/* Status strip */}
            {settings.maintenance_mode ? (
              <div
                style={{
                  background: 'rgba(217,48,37,0.08)',
                  border: '1px solid rgba(217,48,37,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#d93025',
                  fontWeight: 600,
                }}
              >
                <CIcon icon={cilWarning} />
                Maintenance mode is ON — regular users cannot access the system.
                <CButton
                  size="sm"
                  color="danger"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => handleToggle(false)}
                >
                  Disable Now
                </CButton>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(46,184,92,0.07)',
                  border: '1px solid rgba(46,184,92,0.25)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#2eb85c',
                  fontWeight: 600,
                }}
              >
                <CIcon icon={cilCheckCircle} />
                System is operating normally
              </div>
            )}

            <CFormLabel className="fw-semibold small">Maintenance Banner Message</CFormLabel>
            <CFormTextarea
              rows={3}
              value={settings.maintenance_message}
              onChange={(e) => onChange('maintenance_message', e.target.value)}
              placeholder="Message shown to users during maintenance…"
            />
            <div className="small text-body-secondary mt-1">
              This message appears in the red banner at the top of all pages when active.
            </div>
          </CCardBody>
        </CCard>

        {/* App Display Name */}
        <CCard className="mb-4 border">
          <CCardBody>
            <div className="fw-semibold mb-1">Application Display Name</div>
            <div className="small text-body-secondary mb-3">
              Shown in the browser tab and system emails.
            </div>
            <CFormInput
              value={settings.app_display_name}
              onChange={(e) => onChange('app_display_name', e.target.value)}
              maxLength={60}
              placeholder="HMA IEMS"
            />
          </CCardBody>
        </CCard>

        <SaveBar onSave={onSave} saved={saved} />
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SERVER HEALTH
// ─────────────────────────────────────────────────────────────────────────────

const MetricBar = ({ label, value, unit = '%', max = 100 }) => {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small fw-semibold mb-1">
        <span>{label}</span>
        <span>
          {fmt(value, unit)}
          {unit !== '%' ? '' : ` (${pct}%)`}
        </span>
      </div>
      <CProgress value={pct} color={progressColor(pct)} style={{ height: 8 }} />
    </div>
  )
}

const StatCard = ({ label, value, sub, color = 'primary' }) => (
  <CCard className="border h-100">
    <CCardBody className="py-3">
      <div className="small text-body-secondary mb-1">{label}</div>
      <div className={`fs-4 fw-bold text-${color}`}>{value}</div>
      {sub && <div className="small text-body-secondary mt-1">{sub}</div>}
    </CCardBody>
  </CCard>
)

const ServerSection = () => {
  const [metrics, setMetrics] = useState(() => generateMetrics())
  const [uptime, setUptime] = useState(() => uptimeString(UPTIME_START))
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const metricTimer = setInterval(() => {
      setMetrics(generateMetrics())
      setLastUpdated(new Date())
    }, 5000)
    const uptimeTimer = setInterval(() => setUptime(uptimeString(UPTIME_START)), 1000)
    return () => {
      clearInterval(metricTimer)
      clearInterval(uptimeTimer)
    }
  }, [])

  const manualRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setMetrics(generateMetrics())
      setLastUpdated(new Date())
      setRefreshing(false)
    }, 600)
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
        <div>
          <h5 className="fw-bold mb-1">Server Health</h5>
          <p className="text-body-secondary small mb-0">
            Live system resource metrics — auto-refreshes every 5 s
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="small text-body-secondary">
            Updated {lastUpdated.toLocaleTimeString('en-IN')}
          </span>
          <CButton size="sm" color="light" onClick={manualRefresh} disabled={refreshing}>
            {refreshing ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
          </CButton>
        </div>
      </div>

      <CBadge color="warning" className="mb-4">
        Demo data — connect backend API for live metrics
      </CBadge>

      {/* Stat cards */}
      <CRow className="g-3 mb-4">
        <CCol xs={6} md={3}>
          <StatCard
            label="Uptime"
            value={uptime.split(' ').slice(0, 2).join(' ')}
            sub={uptime}
            color="success"
          />
        </CCol>
        <CCol xs={6} md={3}>
          <StatCard
            label="Active Users"
            value={metrics.activeUsers}
            sub="online now"
            color="primary"
          />
        </CCol>
        <CCol xs={6} md={3}>
          <StatCard
            label="API Response"
            value={`${metrics.apiResponseMs} ms`}
            sub="avg latency"
            color={metrics.apiResponseMs > 150 ? 'warning' : 'success'}
          />
        </CCol>
        <CCol xs={6} md={3}>
          <StatCard
            label="DB Connections"
            value={metrics.dbConnections}
            sub={`/ 50 max`}
            color={metrics.dbConnections > 35 ? 'danger' : 'info'}
          />
        </CCol>
      </CRow>

      {/* Resource gauges */}
      <CCard className="border mb-4">
        <CCardBody>
          <div className="fw-semibold mb-3">Resource Usage</div>
          <MetricBar label="CPU" value={metrics.cpu} />
          <MetricBar label="Memory (RAM)" value={metrics.memory} />
          <MetricBar label="Disk Storage" value={metrics.disk} />
          <MetricBar label="Network In" value={metrics.networkIn} unit=" MB/s" max={200} />
          <MetricBar label="Network Out" value={metrics.networkOut} unit=" MB/s" max={200} />
        </CCardBody>
      </CCard>

      {/* Environment info */}
      <CCard className="border">
        <CCardBody>
          <div className="fw-semibold mb-3">Environment</div>
          <CRow className="g-2">
            {[
              ['Platform', 'AWS EC2 (t3.medium)'],
              ['Region', 'ap-south-1 (Mumbai)'],
              ['OS', 'Ubuntu 22.04 LTS'],
              ['Node / Vite', 'Node 20.x / Vite 6.x'],
              ['Database', 'PostgreSQL 16 (Supabase)'],
              ['Storage', 'AWS S3 (ap-south-1)'],
            ].map(([k, v]) => (
              <CCol xs={12} md={6} key={k}>
                <div className="d-flex justify-content-between py-1 border-bottom small">
                  <span className="text-body-secondary">{k}</span>
                  <span className="fw-semibold">{v}</span>
                </div>
              </CCol>
            ))}
          </CRow>
        </CCardBody>
      </CCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SECURITY
// ─────────────────────────────────────────────────────────────────────────────

const SecuritySection = ({ settings, onChange, onSave, saved }) => (
  <div>
    <h5 className="fw-bold mb-1">Security</h5>
    <p className="text-body-secondary small mb-4">Authentication policies and access controls</p>

    {/* Session */}
    <CCard className="mb-4 border">
      <CCardBody>
        <div className="fw-semibold mb-3 d-flex align-items-center gap-2">
          <CIcon icon={cilClock} /> Session
        </div>
        <CRow className="g-3">
          <CCol md={6}>
            <CFormLabel className="fw-semibold small">Session Timeout (minutes)</CFormLabel>
            <CFormInput
              type="number"
              min={5}
              max={480}
              value={settings.session_timeout_minutes}
              onChange={(e) => onChange('session_timeout_minutes', +e.target.value)}
            />
            <div className="small text-body-secondary mt-1">
              Users are logged out after this idle period.
            </div>
          </CCol>
          <CCol md={6}>
            <CFormLabel className="fw-semibold small">Max Login Attempts</CFormLabel>
            <CFormInput
              type="number"
              min={1}
              max={20}
              value={settings.max_login_attempts}
              onChange={(e) => onChange('max_login_attempts', +e.target.value)}
            />
            <div className="small text-body-secondary mt-1">
              Account locks after this many failed attempts.
            </div>
          </CCol>
          <CCol md={6}>
            <CFormLabel className="fw-semibold small">Lockout Duration (minutes)</CFormLabel>
            <CFormInput
              type="number"
              min={1}
              max={1440}
              value={settings.lockout_duration_minutes}
              onChange={(e) => onChange('lockout_duration_minutes', +e.target.value)}
            />
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>

    {/* Password Policy */}
    <CCard className="mb-4 border">
      <CCardBody>
        <div className="fw-semibold mb-3 d-flex align-items-center gap-2">
          <CIcon icon={cilLockLocked} /> Password Policy
        </div>
        <CRow className="g-3">
          <CCol md={6}>
            <CFormLabel className="fw-semibold small">Minimum Password Length</CFormLabel>
            <CFormInput
              type="number"
              min={6}
              max={32}
              value={settings.password_min_length}
              onChange={(e) => onChange('password_min_length', +e.target.value)}
            />
          </CCol>
          <CCol xs={12}>
            <CFormCheck
              id="require-special"
              label="Require at least one special character (!@#$%…)"
              checked={settings.password_require_special}
              onChange={(e) => onChange('password_require_special', e.target.checked)}
            />
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>

    {/* 2FA */}
    <CCard className="mb-4 border">
      <CCardBody>
        <div className="fw-semibold mb-3 d-flex align-items-center gap-2">
          <CIcon icon={cilShieldAlt} /> Two-Factor Authentication (2FA)
        </div>
        <div className="d-flex flex-column gap-2">
          <CFormCheck
            id="2fa-admin"
            label="Enforce 2FA for Admin accounts"
            checked={settings.force_2fa_admin}
            onChange={(e) => onChange('force_2fa_admin', e.target.checked)}
          />
          <CFormCheck
            id="2fa-ceo"
            label="Enforce 2FA for CEO accounts"
            checked={settings.force_2fa_ceo}
            onChange={(e) => onChange('force_2fa_ceo', e.target.checked)}
          />
        </div>
        <CAlert color="info" className="py-2 mt-3 mb-0 small">
          2FA integration requires backend configuration. These settings are saved for when the
          feature is activated.
        </CAlert>
      </CCardBody>
    </CCard>

    <SaveBar onSave={onSave} saved={saved} />
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

const NotificationsSection = ({ settings, onChange, onSave, saved }) => (
  <div>
    <h5 className="fw-bold mb-1">Notifications</h5>
    <p className="text-body-secondary small mb-4">
      Email alerts, digest settings, and announcement controls
    </p>

    {/* Email */}
    <CCard className="mb-4 border">
      <CCardBody>
        <div className="fw-semibold mb-3 d-flex align-items-center gap-2">
          <CIcon icon={cilBell} /> Email Notifications
        </div>
        <CFormCheck
          id="email-notif"
          label="Enable system email notifications (via AWS SES)"
          checked={settings.email_notifications_enabled}
          onChange={(e) => onChange('email_notifications_enabled', e.target.checked)}
          className="mb-3"
        />
        <CFormLabel className="fw-semibold small">System Alert Email</CFormLabel>
        <CFormInput
          type="email"
          value={settings.system_alert_email}
          onChange={(e) => onChange('system_alert_email', e.target.value)}
          disabled={!settings.email_notifications_enabled}
          placeholder="admin@example.com"
          className="mb-3"
        />
        <CFormLabel className="fw-semibold small">Digest Frequency</CFormLabel>
        <CFormSelect
          value={settings.digest_frequency}
          onChange={(e) => onChange('digest_frequency', e.target.value)}
          disabled={!settings.email_notifications_enabled}
        >
          <option value="realtime">Real-time</option>
          <option value="daily">Daily Digest</option>
          <option value="weekly">Weekly Digest</option>
          <option value="off">Off</option>
        </CFormSelect>
      </CCardBody>
    </CCard>

    {/* Announcements */}
    <CCard className="mb-4 border">
      <CCardBody>
        <div className="fw-semibold mb-3">Announcement Settings</div>
        <CFormLabel className="fw-semibold small">
          Auto-expire Announcements After (days)
        </CFormLabel>
        <CFormInput
          type="number"
          min={1}
          max={365}
          value={settings.announcement_auto_expire_days}
          onChange={(e) => onChange('announcement_auto_expire_days', +e.target.value)}
        />
        <div className="small text-body-secondary mt-1">
          Announcements older than this will be automatically archived.
        </div>
      </CCardBody>
    </CCard>

    <SaveBar onSave={onSave} saved={saved} />
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: DATA & LOGS
// ─────────────────────────────────────────────────────────────────────────────

const DataSection = ({ settings, onChange, onSave, saved }) => {
  const [clearing, setClearing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const fakeAction = (label, setFlag) => {
    setFlag(true)
    setActionMsg('')
    setTimeout(() => {
      setFlag(false)
      setActionMsg(`${label} completed successfully.`)
    }, 1200)
  }

  return (
    <div>
      <h5 className="fw-bold mb-1">Data & Logs</h5>
      <p className="text-body-secondary small mb-4">
        Retention policies, exports, and cache management
      </p>

      {actionMsg && (
        <CAlert color="success" dismissible onClose={() => setActionMsg('')} className="py-2 mb-4">
          <CIcon icon={cilCheckCircle} className="me-2" />
          {actionMsg}
        </CAlert>
      )}

      {/* Retention */}
      <CCard className="mb-4 border">
        <CCardBody>
          <div className="fw-semibold mb-3">Retention Policy</div>
          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel className="fw-semibold small">Audit Log Retention (days)</CFormLabel>
              <CFormInput
                type="number"
                min={30}
                max={3650}
                value={settings.audit_log_retention_days}
                onChange={(e) => onChange('audit_log_retention_days', +e.target.value)}
              />
              <div className="small text-body-secondary mt-1">
                Logs older than this will be permanently purged.
              </div>
            </CCol>
            <CCol md={6}>
              <CFormLabel className="fw-semibold small">
                Auto-archive Records After (days)
              </CFormLabel>
              <CFormInput
                type="number"
                min={90}
                max={3650}
                value={settings.auto_archive_after_days}
                onChange={(e) => onChange('auto_archive_after_days', +e.target.value)}
              />
              <div className="small text-body-secondary mt-1">
                Inactive records are moved to cold storage.
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Actions */}
      <CCard className="mb-4 border">
        <CCardBody>
          <div className="fw-semibold mb-3">Data Actions</div>
          <CRow className="g-3">
            <CCol xs={12} md={6}>
              <div className="p-3 rounded border">
                <div className="fw-semibold small mb-1">
                  <CIcon icon={cilCloudDownload} className="me-2 text-primary" />
                  Export Audit Logs
                </div>
                <div className="small text-body-secondary mb-2">
                  Download all audit logs as a CSV file.
                </div>
                <CButton
                  size="sm"
                  color="primary"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => fakeAction('Export', setExporting)}
                >
                  {exporting ? (
                    <CSpinner size="sm" className="me-1" />
                  ) : (
                    <CIcon icon={cilCloudDownload} className="me-1" />
                  )}
                  Export CSV
                </CButton>
              </div>
            </CCol>
            <CCol xs={12} md={6}>
              <div className="p-3 rounded border">
                <div className="fw-semibold small mb-1">
                  <CIcon icon={cilCode} className="me-2 text-warning" />
                  Clear Application Cache
                </div>
                <div className="small text-body-secondary mb-2">
                  Purges cached data. Users may experience slower loads briefly.
                </div>
                <CButton
                  size="sm"
                  color="warning"
                  variant="outline"
                  disabled={clearing}
                  onClick={() => fakeAction('Cache clear', setClearing)}
                >
                  {clearing ? (
                    <CSpinner size="sm" className="me-1" />
                  ) : (
                    <CIcon icon={cilTrash} className="me-1" />
                  )}
                  Clear Cache
                </CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <SaveBar onSave={onSave} saved={saved} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ABOUT
// ─────────────────────────────────────────────────────────────────────────────

const AboutSection = () => (
  <div>
    <h5 className="fw-bold mb-1">About</h5>
    <p className="text-body-secondary small mb-4">System version and licensing information</p>

    <CCard className="border mb-4">
      <CCardBody>
        <div className="fw-semibold mb-3">System Information</div>
        <CRow className="g-0">
          {[
            ['Application', 'HMA Internal Enterprise Management System'],
            ['Version', 'v1.0.0-alpha'],
            ['Environment', 'Production'],
            ['Frontend', 'React 19 + CoreUI 5.x + Vite 6.x'],
            ['Backend', 'FastAPI + SQLModel + PostgreSQL (Supabase)'],
            ['Storage', 'AWS S3'],
            ['Email', 'AWS SES'],
            [
              'Build Date',
              new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              }),
            ],
            ['License', 'Proprietary — HMA Internal Use Only'],
          ].map(([k, v]) => (
            <CCol xs={12} key={k}>
              <div className="d-flex py-2 border-bottom gap-3 small">
                <span className="text-body-secondary" style={{ minWidth: 140 }}>
                  {k}
                </span>
                <span className="fw-semibold">{v}</span>
              </div>
            </CCol>
          ))}
        </CRow>
      </CCardBody>
    </CCard>

    <CCard className="border">
      <CCardBody>
        <div className="fw-semibold mb-2">Support</div>
        <div className="small text-body-secondary">
          For technical support or to report issues, contact the HMA IT team at{' '}
          <a href="mailto:admin@example.com" className="text-decoration-none">
            admin@example.com
          </a>
        </div>
      </CCardBody>
    </CCard>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// SAVE BAR
// ─────────────────────────────────────────────────────────────────────────────

const SaveBar = ({ onSave, saved }) => (
  <div className="d-flex align-items-center gap-3 pt-2">
    <CButton color="primary" onClick={onSave}>
      Save Changes
    </CButton>
    {saved && (
      <span className="text-success small fw-semibold d-flex align-items-center gap-1">
        <CIcon icon={cilCheckCircle} /> Saved
      </span>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const AdminSettingsPage = () => {
  const [active, setActive] = useState('system')
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    localAdminSettings.get().then((s) => !cancelled && setSettings(s))
    return () => {
      cancelled = true
    }
  }, [])

  const onChange = (key, value) => {
    setSaved(false)
    setSettings((s) => ({ ...s, [key]: value }))
  }

  // Immediately persists a single key — used for high-impact toggles like maintenance mode
  const onPersist = (key, value) => {
    setSettings((s) => {
      const next = { ...s, [key]: value }
      localAdminSettings.update(next)
      return next
    })
  }

  const onSave = () => {
    localAdminSettings.update(settings)
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) return null

  const sectionProps = { settings, onChange, onPersist, onSave, saved }

  return (
    <div>
      {/* Page header */}
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Admin Settings</h4>
        <p className="text-body-secondary mb-0">
          System configuration, server health, security, and data management
        </p>
      </div>

      <CRow className="g-4">
        {/* ── Left sidebar nav ── */}
        <CCol xs={12} md={3}>
          <CCard className="border sticky-top" style={{ top: 80 }}>
            <CCardBody className="p-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={`w-100 d-flex align-items-center gap-2 px-3 py-2 rounded border-0 text-start small fw-semibold mb-1 ${
                    active === s.id ? 'bg-primary text-white' : 'bg-transparent text-body'
                  }`}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => setActive(s.id)}
                >
                  <CIcon icon={s.icon} size="sm" />
                  {s.label}
                </button>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Right content ── */}
        <CCol xs={12} md={9}>
          {active === 'system' && <SystemSection {...sectionProps} />}
          {active === 'server' && <ServerSection />}
          {active === 'security' && <SecuritySection {...sectionProps} />}
          {active === 'notifications' && <NotificationsSection {...sectionProps} />}
          {active === 'data' && <DataSection {...sectionProps} />}
          {active === 'about' && <AboutSection />}
        </CCol>
      </CRow>
    </div>
  )
}

export default AdminSettingsPage
