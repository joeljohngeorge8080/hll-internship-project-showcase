/**
 * useAuth Hook
 *
 * Reads the current authenticated user and token from the Redux store.
 *
 * @returns {{ user: Object|null, token: string|null, isAuthenticated: boolean }}
 */

import { useSelector } from 'react-redux'

const useAuth = () => {
  const user = useSelector((state) => state.user)
  const token = useSelector((state) => state.token)

  return {
    user: user || null,
    token: token || null,
    isAuthenticated: Boolean(user),
  }
}

export default useAuth
