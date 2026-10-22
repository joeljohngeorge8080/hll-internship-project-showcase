import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CFormSelect, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilEnvelopeLetter, cilEnvelopeOpen } from '@coreui/icons'
import { localAnnouncements, MSG_TYPE_META, MSG_TYPE } from '../../../services/localAnnouncements'
import { useSelector } from 'react-redux'
import useRole from '../../../hooks/useRole'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const TypeBadge = ({ type }) => {
  const meta = MSG_TYPE_META[type] || MSG_TYPE_META[MSG_TYPE.INFO]
  return (
    <CBadge color={meta.color} className="me-1">
      {meta.label}
    </CBadge>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INBOX PAGE
// ─────────────────────────────────────────────────────────────────────────────

const AnnouncementsInboxPage = () => {
  const user = useSelector((s) => s.user)
  const role = useRole()
  const userId = user?.id || user?.employee_id || 'unknown'

  const [raw, setRaw] = useState([])
  const [filter, setFilter] = useState('')
  const [readFilter, setReadFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const prevRole = useRef(role)

  const reload = () => localAnnouncements.listForRole(role || '').then(setRaw)

  // Initial load, and re-fetch when role changes (login/logout); role is
  // stable within a session.
  useEffect(() => {
    if (prevRole.current !== role || raw.length === 0) {
      prevRole.current = role
      reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const messages = useMemo(() => {
    let msgs = raw
    if (filter) msgs = msgs.filter((m) => m.type === filter)
    if (readFilter === 'unread') msgs = msgs.filter((m) => !m.read_by.includes(userId))
    if (readFilter === 'read') msgs = msgs.filter((m) => m.read_by.includes(userId))
    return msgs
  }, [raw, filter, readFilter, userId])

  const markRead = async (msg) => {
    if (!msg.read_by.includes(userId)) {
      await localAnnouncements.markRead(msg.id, userId)
      reload()
    }
    setExpanded(expanded === msg.id ? null : msg.id)
  }

  const markAllRead = async () => {
    await localAnnouncements.markAllRead(role || '', userId)
    reload()
  }

  const unreadCount = messages.filter((m) => !m.read_by.includes(userId)).length

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-bold">Announcements & Notifications</h4>
          <p className="text-body-secondary mb-0">Messages from the CEO and management</p>
        </div>
        {unreadCount > 0 && (
          <CButton size="sm" color="primary" variant="ghost" onClick={markAllRead}>
            <CIcon icon={cilCheckCircle} className="me-1" />
            Mark all as read ({unreadCount})
          </CButton>
        )}
      </div>

      {/* Filters */}
      <CRow className="g-2 mb-4">
        <CCol xs="auto">
          <CFormSelect
            size="sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">All Types</option>
            {Object.entries(MSG_TYPE_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs="auto">
          <CFormSelect
            size="sm"
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="all">All Messages</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read</option>
          </CFormSelect>
        </CCol>
        <CCol xs="auto" className="d-flex align-items-center">
          {unreadCount > 0 && (
            <CBadge color="danger" className="ms-1">
              {unreadCount} unread
            </CBadge>
          )}
        </CCol>
      </CRow>

      {messages.length === 0 && (
        <div className="text-center text-body-secondary py-5">
          <CIcon
            icon={cilEnvelopeLetter}
            style={{ width: 48, height: 48 }}
            className="mb-2 text-body-secondary"
          />
          <div className="mt-2">
            {filter || readFilter !== 'all'
              ? 'No messages match your filters.'
              : 'No announcements yet. Check back later.'}
          </div>
        </div>
      )}

      <div className="d-flex flex-column gap-3">
        {messages.map((msg) => {
          const meta = MSG_TYPE_META[msg.type] || MSG_TYPE_META[MSG_TYPE.INFO]
          const isRead = msg.read_by.includes(userId)
          const isExpanded = expanded === msg.id

          return (
            <CCard
              key={msg.id}
              className="border"
              style={{
                borderLeft: `4px solid var(--cui-${meta.color})`,
                opacity: isRead ? 0.85 : 1,
              }}
            >
              <CCardBody className="py-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                      <TypeBadge type={msg.type} />
                      <span className={`fw-semibold${isRead ? '' : ' text-body-emphasis'}`}>
                        {msg.title}
                      </span>
                      {!isRead && (
                        <CBadge color="primary" shape="rounded-pill" className="ms-1">
                          New
                        </CBadge>
                      )}
                    </div>

                    <div style={{ fontSize: 12 }} className="text-body-secondary mb-1">
                      <span>
                        From: <strong>{msg.sent_by}</strong>
                      </span>
                      <span className="mx-2">·</span>
                      <span>{fmt(msg.sent_at)}</span>
                    </div>

                    {isExpanded && (
                      <div
                        className="mt-2 p-3 rounded"
                        style={{
                          whiteSpace: 'pre-wrap',
                          background: 'var(--cui-tertiary-bg, var(--cui-light))',
                          wordBreak: 'break-word',
                          fontSize: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        {msg.body}
                      </div>
                    )}
                  </div>

                  <CButton
                    size="sm"
                    color={isRead ? 'light' : 'primary'}
                    variant={isRead ? 'ghost' : 'outline'}
                    onClick={() => markRead(msg)}
                    className="flex-shrink-0"
                  >
                    <CIcon
                      icon={isExpanded ? cilEnvelopeOpen : cilEnvelopeLetter}
                      className="me-1"
                    />
                    {isExpanded ? 'Collapse' : isRead ? 'View' : 'Open'}
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    </div>
  )
}

export default AnnouncementsInboxPage
