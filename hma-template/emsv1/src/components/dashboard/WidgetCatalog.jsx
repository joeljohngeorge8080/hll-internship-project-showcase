import React from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormSwitch,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

const WidgetCatalog = ({ visible, onClose, allWidgets, activeIds, onToggle, onReset }) => {
  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center" scrollable>
      <CModalHeader closeButton>
        <CModalTitle>Customize Dashboard</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-3">
          Toggle widgets on or off. Your layout is saved automatically.
        </p>
        <div className="d-flex flex-column gap-2">
          {allWidgets.map((widget) => {
            const isActive = activeIds.includes(widget.id)
            return (
              <div
                key={widget.id}
                className={`d-flex align-items-center justify-content-between rounded-3 px-3 py-2 border ${
                  isActive ? 'border-primary bg-primary-subtle' : 'border bg-body-secondary'
                }`}
              >
                <div className="me-3 min-w-0">
                  <div className="fw-semibold small">{widget.title}</div>
                  {widget.description && (
                    <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                      {widget.description}
                    </div>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  {widget.badge && (
                    <CBadge color={widget.badge.color} shape="rounded-pill" className="px-2 small">
                      {widget.badge.label}
                    </CBadge>
                  )}
                  <CFormSwitch
                    checked={isActive}
                    onChange={() => onToggle(widget.id)}
                    aria-label={`Toggle ${widget.title}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CModalBody>
      <CModalFooter className="justify-content-between">
        <CButton color="secondary" variant="ghost" size="sm" onClick={onReset}>
          <CIcon icon={cilReload} className="me-1" size="sm" />
          Reset to Default
        </CButton>
        <CButton color="primary" onClick={onClose}>
          Done
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default WidgetCatalog
