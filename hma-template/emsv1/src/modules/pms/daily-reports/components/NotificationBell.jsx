/**
 * NotificationBell — Nav bell icon with badge count.
 *
 * For Field Personnel: count of declined reports.
 * For Project Officer: count of pending/resubmitted reports.
 */
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'
import { localReports } from '../../../../services/localReports'

const NotificationBell = ({ role = '', onClick }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const updateCount = () => {
      localReports.getNotificationCounts(role).then((counts) => {
        if (!cancelled) setCount(counts.total || 0)
      })
    }
    updateCount()

    // Poll every 5 seconds for changes (replace with event system later)
    const interval = setInterval(updateCount, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [role])

  return (
    <div
      className="notification-bell position-relative d-inline-flex align-items-center"
      role="button"
      onClick={onClick}
      title={count > 0 ? `${count} notification(s)` : 'No notifications'}
    >
      <CIcon icon={cilBell} size="lg" />
      {count > 0 && (
        <CBadge
          color="danger"
          shape="rounded-pill"
          className="position-absolute notification-bell-badge"
          style={{ top: '-4px', right: '-8px', fontSize: '0.65rem', minWidth: '18px' }}
        >
          {count > 99 ? '99+' : count}
        </CBadge>
      )}
    </div>
  )
}

NotificationBell.propTypes = {
  role: PropTypes.string,
  onClick: PropTypes.func,
}

export default NotificationBell
