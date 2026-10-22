/**
 * usePermission Hook
 *
 * Resolves whether the current role may perform an action on a module
 * against the PERMISSIONS matrix.
 *
 *   action 'view' → satisfied by 'V' or 'E'
 *   action 'edit' → satisfied by 'E' only
 *
 * @param {string} moduleKey - A key from constants/modules.js
 * @param {('view'|'edit')} [action='view']
 * @returns {boolean}
 */

import { PERMISSIONS, ACCESS } from '../constants/permissions'
import { ROLE } from '../constants/roles'
import useRole from './useRole'

const usePermission = (moduleKey, action = 'view') => {
  const role = useRole()
  if (!role) {
    return false
  }
  // Admin has full access to everything
  if (role === ROLE.ADMIN) {
    return true
  }

  const access = PERMISSIONS[moduleKey]?.[role] ?? ACCESS.NONE

  if (action === 'edit') {
    return access === ACCESS.EDIT
  }
  return access === ACCESS.VIEW || access === ACCESS.EDIT
}

export { usePermission }
export default usePermission
