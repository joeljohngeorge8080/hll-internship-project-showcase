/**
 * Placeholder View
 *
 * Generic "module coming soon" page used during early build phases so that
 * every route/sidebar link resolves to a real page. Replaced module-by-module
 * as each feature is implemented.
 *
 * @component
 */

import React from 'react'
import PropTypes from 'prop-types'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'

const Placeholder = ({ title, message }) => {
  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>{title}</strong>
      </CCardHeader>
      <CCardBody>
        <p className="text-body-secondary mb-0">{message}</p>
      </CCardBody>
    </CCard>
  )
}

Placeholder.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
}

Placeholder.defaultProps = {
  message: 'This module is coming soon.',
}

export default Placeholder
