import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import useRole from './useRole'
import { localAnnouncements } from '../services/localAnnouncements'

// Polls for unread announcement count every 30 seconds.
const useUnreadAnnouncements = () => {
  const role = useRole()
  const user = useSelector((s) => s.user)
  const userId = user?.id || user?.employee_id || 'unknown'

  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!role) return
    const update = () => setCount(localAnnouncements.unreadCount(role, userId))
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [role, userId])

  return count
}

export default useUnreadAnnouncements
