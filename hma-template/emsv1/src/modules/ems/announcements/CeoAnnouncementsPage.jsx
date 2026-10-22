import React, { useEffect, useRef, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilNotes,
  cilPaperPlane,
  cilPencil,
  cilPlus,
  cilSend,
  cilTrash,
} from '@coreui/icons'
import {
  localAnnouncements,
  localCeoNotes,
  MSG_TYPE,
  MSG_TYPE_META,
  NOTE_COLORS,
} from '../../../services/localAnnouncements'
import { ROLES, ROLE, roleDisplayName } from '../../../constants/roles'
import { useSelector } from 'react-redux'

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

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const TARGET_ROLES = ROLES.filter((r) => r !== ROLE.CEO && r !== ROLE.ADMIN)

const NOTE_COLOR_STYLES = {
  default: { bg: 'var(--cui-card-bg)', border: 'var(--cui-border-color)' },
  primary: { bg: 'rgba(50,121,243,0.08)', border: '#3279f3' },
  success: { bg: 'rgba(46,184,92,0.08)', border: '#2eb85c' },
  warning: { bg: 'rgba(240,185,11,0.08)', border: '#f0b90b' },
  danger: { bg: 'rgba(229,83,83,0.08)', border: '#e55353' },
  info: { bg: 'rgba(57,183,211,0.08)', border: '#39b7d3' },
}

// ── Empty forms ───────────────────────────────────────────────────────────────

const EMPTY_MSG = {
  type: MSG_TYPE.ANNOUNCEMENT,
  title: '',
  body: '',
  target_roles: [],
  send_to_all: true,
}

const EMPTY_NOTE = { title: '', body: '', color: 'default' }

// ── Sub-components ────────────────────────────────────────────────────────────

const TypeBadge = ({ type }) => {
  const meta = MSG_TYPE_META[type] || MSG_TYPE_META[MSG_TYPE.INFO]
  return (
    <CBadge color={meta.color} className="me-1">
      {meta.label}
    </CBadge>
  )
}

const RolePill = ({ role }) => (
  <CBadge color="secondary" className="me-1 mb-1 fw-normal">
    {roleDisplayName(role)}
  </CBadge>
)

// ─────────────────────────────────────────────────────────────────────────────
// NOTES TAB
// ─────────────────────────────────────────────────────────────────────────────

const NotesTab = () => {
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(EMPTY_NOTE)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const reload = () => localCeoNotes.list().then(setNotes)

  useEffect(() => {
    reload()
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const openNew = () => {
    setForm(EMPTY_NOTE)
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (note) => {
    setForm({ title: note.title, body: note.body, color: note.color })
    setEditing(note.id)
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) {
      setError('Note title is required.')
      return
    }
    if (editing) {
      await localCeoNotes.update(editing, form)
    } else {
      await localCeoNotes.create(form)
    }
    setShowForm(false)
    reload()
  }

  const remove = async (id) => {
    if (window.confirm('Delete this note?')) {
      await localCeoNotes.delete(id)
      reload()
    }
  }

  const colorDotStyle = (c) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: 6,
    background: c === 'default' ? 'var(--cui-body-color)' : `var(--cui-${c})`,
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h6 className="mb-0 fw-semibold">Personal Notes</h6>
          <small className="text-body-secondary">Private — visible only to you</small>
        </div>
        <CButton color="primary" size="sm" onClick={openNew}>
          <CIcon icon={cilPlus} className="me-1" /> New Note
        </CButton>
      </div>

      {showForm && (
        <CCard className="mb-4 border">
          <CCardBody>
            <CRow className="g-3">
              <CCol md={8}>
                <CFormLabel className="fw-semibold">
                  Title <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Note title"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Color Tag</CFormLabel>
                <CFormSelect value={form.color} onChange={(e) => set('color', e.target.value)}>
                  {NOTE_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12}>
                <CFormLabel className="fw-semibold">Body</CFormLabel>
                <CFormTextarea
                  rows={4}
                  value={form.body}
                  onChange={(e) => set('body', e.target.value)}
                  placeholder="Write your note here…"
                />
              </CCol>
            </CRow>
            {error && (
              <CAlert color="danger" className="mt-3 py-2 mb-0">
                {error}
              </CAlert>
            )}
            <div className="d-flex gap-2 mt-3">
              <CButton color="primary" size="sm" onClick={save}>
                <CIcon icon={cilNotes} className="me-1" /> {editing ? 'Update' : 'Save Note'}
              </CButton>
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )}

      {notes.length === 0 && !showForm && (
        <div className="text-center text-body-secondary py-5">
          <CIcon
            icon={cilNotes}
            style={{ width: 40, height: 40 }}
            className="mb-2 text-body-secondary"
          />
          <div className="mt-2">No personal notes yet. Create your first note above.</div>
        </div>
      )}

      <CRow className="g-3">
        {notes.map((note) => {
          const cs = NOTE_COLOR_STYLES[note.color] || NOTE_COLOR_STYLES.default
          return (
            <CCol md={6} xl={4} key={note.id}>
              <div
                style={{
                  background: cs.bg,
                  border: `1.5px solid ${cs.border}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="fw-semibold" style={{ wordBreak: 'break-word' }}>
                    <span style={colorDotStyle(note.color)} />
                    {note.title}
                  </div>
                  <div className="d-flex gap-1 ms-2 flex-shrink-0">
                    <CButton
                      size="sm"
                      color="light"
                      variant="ghost"
                      onClick={() => openEdit(note)}
                      title="Edit"
                    >
                      <CIcon icon={cilPencil} size="sm" />
                    </CButton>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      onClick={() => remove(note.id)}
                      title="Delete"
                    >
                      <CIcon icon={cilTrash} size="sm" />
                    </CButton>
                  </div>
                </div>
                <div
                  className="text-body-secondary small flex-grow-1"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {note.body || <span className="fst-italic">No content</span>}
                </div>
                <div className="text-body-secondary mt-2" style={{ fontSize: 11 }}>
                  Updated {fmtDate(note.updated_at)}
                </div>
              </div>
            </CCol>
          )
        })}
      </CRow>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE TAB
// ─────────────────────────────────────────────────────────────────────────────

const ComposeTab = ({ onSent }) => {
  const user = useSelector((s) => s.user)
  const [form, setForm] = useState(EMPTY_MSG)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleRole = (role) => {
    setForm((f) => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter((r) => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const send = async () => {
    setError('')
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    if (!form.body.trim()) {
      setError('Message body is required.')
      return
    }
    if (!form.send_to_all && form.target_roles.length === 0) {
      setError('Select at least one recipient role, or choose "Send to All".')
      return
    }

    setSending(true)
    try {
      await localAnnouncements.send({
        ...form,
        target_roles: form.send_to_all ? ['all'] : form.target_roles,
        sent_by: user?.full_name || user?.employee_id || 'CEO',
      })
      setSuccess(`"${form.title}" sent successfully.`)
      setForm(EMPTY_MSG)
      onSent?.()
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h6 className="mb-0 fw-semibold">Compose Message</h6>
        <small className="text-body-secondary">
          Send announcements, alerts, warnings, reports & more
        </small>
      </div>

      {success && (
        <CAlert color="success" dismissible onClose={() => setSuccess('')} className="py-2">
          {success}
        </CAlert>
      )}
      {error && (
        <CAlert color="danger" className="py-2">
          {error}
        </CAlert>
      )}

      <CCard className="border">
        <CCardBody>
          <CRow className="g-3">
            {/* Message type */}
            <CCol md={4}>
              <CFormLabel className="fw-semibold">
                Message Type <span className="text-danger">*</span>
              </CFormLabel>
              <CFormSelect value={form.type} onChange={(e) => set('type', e.target.value)}>
                {Object.entries(MSG_TYPE_META).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            {/* Title */}
            <CCol md={8}>
              <CFormLabel className="fw-semibold">
                Subject / Title <span className="text-danger">*</span>
              </CFormLabel>
              <CFormInput
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Enter message subject"
                maxLength={200}
              />
            </CCol>

            {/* Body */}
            <CCol xs={12}>
              <CFormLabel className="fw-semibold">
                Message Body <span className="text-danger">*</span>
              </CFormLabel>
              <CFormTextarea
                rows={6}
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder="Write your message here…"
              />
            </CCol>

            {/* Audience */}
            <CCol xs={12}>
              <CFormLabel className="fw-semibold d-block mb-2">Recipients</CFormLabel>
              <CFormCheck
                id="send-all"
                label="Send to All Staff"
                checked={form.send_to_all}
                onChange={(e) => set('send_to_all', e.target.checked)}
                className="mb-2"
              />
              {!form.send_to_all && (
                <div className="p-3 rounded border" style={{ background: 'var(--cui-body-bg)' }}>
                  <div className="small fw-semibold text-body-secondary mb-2">
                    Select specific roles:
                  </div>
                  <CRow className="g-2">
                    {TARGET_ROLES.map((role) => (
                      <CCol xs="auto" key={role}>
                        <CFormCheck
                          id={`role-${role}`}
                          label={roleDisplayName(role)}
                          checked={form.target_roles.includes(role)}
                          onChange={() => toggleRole(role)}
                        />
                      </CCol>
                    ))}
                  </CRow>
                </div>
              )}
            </CCol>

            {/* Preview */}
            <CCol xs={12}>
              <div
                className="p-3 rounded border small"
                style={{ background: 'var(--cui-tertiary-bg, var(--cui-light))' }}
              >
                <span className="text-body-secondary fw-semibold me-2">Preview:</span>
                <TypeBadge type={form.type} />
                <span className="fw-semibold">{form.title || 'No title'}</span>
                <span className="ms-2 text-body-secondary">
                  →{' '}
                  {form.send_to_all
                    ? 'All Staff'
                    : form.target_roles.join(', ') || 'No roles selected'}
                </span>
              </div>
            </CCol>
          </CRow>

          <div className="d-flex gap-2 mt-4">
            <CButton color="primary" onClick={send} disabled={sending}>
              <CIcon icon={cilSend} className="me-2" />
              {sending ? 'Sending…' : 'Send Now'}
            </CButton>
            <CButton
              color="secondary"
              variant="ghost"
              onClick={() => {
                setForm(EMPTY_MSG)
                setError('')
              }}
            >
              Clear
            </CButton>
          </div>
        </CCardBody>
      </CCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SENT TAB
// ─────────────────────────────────────────────────────────────────────────────

const SentTab = ({ refreshKey }) => {
  const [raw, setRaw] = useState([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(null)

  const reload = () => localAnnouncements.listAll().then(setRaw)

  // Re-fetch from store when parent signals a new send (refreshKey increments)
  useEffect(() => {
    reload()
  }, [refreshKey])

  const messages = useMemo(
    () => (filter ? raw.filter((r) => r.type === filter) : raw),
    [raw, filter],
  )

  const remove = async (id) => {
    if (window.confirm('Delete this announcement? Recipients will no longer see it.')) {
      await localAnnouncements.delete(id)
      reload()
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h6 className="mb-0 fw-semibold">Sent Announcements</h6>
          <small className="text-body-secondary">{messages.length} message(s)</small>
        </div>
        <div style={{ width: 180 }}>
          <CFormSelect size="sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(MSG_TYPE_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </CFormSelect>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="text-center text-body-secondary py-5">
          <div style={{ fontSize: 36 }}>📭</div>
          <div className="mt-2">No sent announcements yet.</div>
        </div>
      )}

      <div className="d-flex flex-column gap-3">
        {messages.map((msg) => {
          const meta = MSG_TYPE_META[msg.type] || MSG_TYPE_META[MSG_TYPE.INFO]
          const isExpanded = expanded === msg.id
          return (
            <CCard
              key={msg.id}
              className="border"
              style={{ borderLeft: `4px solid var(--cui-${meta.color})` }}
            >
              <CCardBody className="py-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                      <TypeBadge type={msg.type} />
                      <span className="fw-semibold">{msg.title}</span>
                    </div>
                    <div className="d-flex gap-2 flex-wrap mb-1">
                      {msg.target_roles.includes('all') ? (
                        <RolePill role="All Staff" />
                      ) : (
                        msg.target_roles.map((r) => <RolePill key={r} role={r} />)
                      )}
                    </div>
                    {isExpanded && (
                      <div
                        className="text-body-secondary small mt-2 p-2 rounded"
                        style={{
                          whiteSpace: 'pre-wrap',
                          background: 'var(--cui-tertiary-bg, var(--cui-light))',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.body}
                      </div>
                    )}
                    <div className="mt-1" style={{ fontSize: 11 }}>
                      <span className="text-body-secondary">Sent {fmt(msg.sent_at)}</span>
                      <span className="ms-2 text-body-secondary">· {msg.read_by.length} read</span>
                    </div>
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    <CButton
                      size="sm"
                      color="light"
                      variant="ghost"
                      onClick={() => setExpanded(isExpanded ? null : msg.id)}
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </CButton>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      onClick={() => remove(msg.id)}
                      title="Delete"
                    >
                      <CIcon icon={cilTrash} size="sm" />
                    </CButton>
                  </div>
                </div>
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const CeoAnnouncementsPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sentKey, setSentKey] = useState(0)

  const activeTab = useMemo(() => {
    if (location.pathname.endsWith('/compose')) return 'compose'
    if (location.pathname.endsWith('/sent')) return 'sent'
    return 'notes'
  }, [location.pathname])

  const goTab = (tab) => {
    if (tab === 'notes') navigate('/ems/announcements')
    else navigate(`/ems/announcements/${tab}`)
  }

  const handleSent = () => {
    setSentKey((k) => k + 1)
    navigate('/ems/announcements/sent')
  }

  return (
    <div>
      <div className="mb-4">
        <h4 className="mb-1 fw-bold">CEO Announcements</h4>
        <p className="text-body-secondary mb-0">
          Manage personal notes, compose & send company-wide messages
        </p>
      </div>

      <CNav variant="tabs" className="mb-4">
        <CNavItem>
          <CNavLink
            active={activeTab === 'notes'}
            onClick={() => goTab('notes')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilNotes} className="me-2" />
            Personal Notes
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'compose'}
            onClick={() => goTab('compose')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilPaperPlane} className="me-2" />
            Compose
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'sent'}
            onClick={() => goTab('sent')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilBell} className="me-2" />
            Sent
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'notes'}>
          <NotesTab />
        </CTabPane>
        <CTabPane visible={activeTab === 'compose'}>
          <ComposeTab onSent={handleSent} />
        </CTabPane>
        <CTabPane visible={activeTab === 'sent'}>
          <SentTab refreshKey={sentKey} />
        </CTabPane>
      </CTabContent>
    </div>
  )
}

export default CeoAnnouncementsPage
