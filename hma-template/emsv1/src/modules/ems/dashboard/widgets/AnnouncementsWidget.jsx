import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'
import { localAnnouncements } from '../../../../services/localAnnouncements'
import useRole from '../../../../hooks/useRole'

const fmtDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_META = {
  announcement: { label: 'Announcement', color: 'primary' },
  notice: { label: 'Notice', color: 'warning' },
  urgent: { label: 'Urgent', color: 'danger' },
  info: { label: 'Info', color: 'info' },
}

const AnnouncementsWidget = () => {
  const role = useRole()
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = role ? localAnnouncements.listForRole(role) : localAnnouncements.listAll()
    load.then((list) => !cancelled && setItems(list.slice(0, 5)))
    return () => {
      cancelled = true
    }
  }, [role])

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Recent Announcements
        </h6>
        {items.length === 0 ? (
          <div className="text-center text-body-secondary py-3">
            <CIcon
              icon={cilBell}
              style={{ width: 32, height: 32, opacity: 0.4 }}
              className="mb-2 d-block mx-auto"
            />
            <div className="small">No announcements</div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {items.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.announcement
              return (
                <div
                  key={item.id}
                  className="rounded-3 px-3 py-2"
                  style={{
                    background: 'var(--cui-body-bg)',
                    border: '1px solid var(--cui-border-color)',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <CBadge color={meta.color} shape="rounded-pill" style={{ fontSize: '0.65rem' }}>
                      {meta.label}
                    </CBadge>
                    <span className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                      {fmtDate(item.sent_at)}
                    </span>
                  </div>
                  <div className="fw-semibold small text-truncate">{item.title}</div>
                  {item.body && (
                    <div
                      className="text-body-secondary mt-1"
                      style={{
                        fontSize: '0.72rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.body}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default AnnouncementsWidget
