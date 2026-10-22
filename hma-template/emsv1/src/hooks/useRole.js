/**
 * useRole Hook
 *
 * Returns the current user's role string, or null when not authenticated.
 *
 * @returns {string|null}
 */

import { useSelector } from 'react-redux'

const useRole = () => {
  const user = useSelector((state) => state.user)
  return user?.role || null
}

export default useRole
