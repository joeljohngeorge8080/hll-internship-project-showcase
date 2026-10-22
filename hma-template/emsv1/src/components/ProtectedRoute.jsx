import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { CAlert } from '@coreui/react'

import useAuth from '../hooks/useAuth'
import usePermission from '../hooks/usePermission'
import useRole from '../hooks/useRole'
import { ROLE, roleDisplayName } from '../constants/roles'
import { localAudit } from '../services/localAudit'

const ProtectedRoute = ({ module, action, children }) => {
  const { isAuthenticated } = useAuth()
  const allowed = usePermission(module, action)
  const role = useRole()

  const getPmsFallback = (role) => {
    if (role === ROLE.PROJECT_COORDINATOR || role === ROLE.PROJECT_ASSOCIATE || role === ROLE.PROJECT_OFFICER) {
      return '/pms/pa/dashboard'
    }
    return '/pms/dashboard'
  }

  // Record every denied-access view so it's discoverable from the audit log,
  // instead of only ever rendering a "No Access" message nobody else sees.
  useEffect(() => {
    if (isAuthenticated && !allowed) {
      localAudit.write({
        module: 'AccessControl',
        action: 'ACCESS_DENIED',
        record_label: module,
        details: `${roleDisplayName(role)} was denied ${action} access to ${module}`,
      })
    }
  }, [isAuthenticated, allowed, module, action, role])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!allowed) {
    return (
      <CAlert color="danger" className="mt-4">
        <h4 className="alert-heading">No Access</h4>
        <p className="mb-0">
          You do not have permission to view this screen (current role:{' '}
          {roleDisplayName(role)}).
        </p>
      </CAlert>
    )
  }

  return children
}

ProtectedRoute.propTypes = {
  module: PropTypes.string.isRequired,
  action: PropTypes.oneOf(['view', 'edit']),
  children: PropTypes.node.isRequired,
}

ProtectedRoute.defaultProps = {
  action: 'view',
}

export default ProtectedRoute
