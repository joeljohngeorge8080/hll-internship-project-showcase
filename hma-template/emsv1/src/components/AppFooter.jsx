import React from 'react'
import { CFooter } from '@coreui/react'

const AppFooter = () => {
  return (
    <CFooter className="px-4" style={{ fontSize: '0.8rem' }}>
      <div className="d-flex align-items-center gap-2">
        <span className="fw-semibold" style={{ color: 'var(--cui-body-color)' }}>
          HMA IEMS
        </span>
        <span style={{ color: 'var(--cui-secondary-color)' }}>
          &copy; {new Date().getFullYear()} HMA. All rights reserved.
        </span>
      </div>
      <div className="ms-auto" style={{ color: 'var(--cui-tertiary-color)' }}>
        Internal Enterprise Management System
      </div>
    </CFooter>
  )
}

export default React.memo(AppFooter)
