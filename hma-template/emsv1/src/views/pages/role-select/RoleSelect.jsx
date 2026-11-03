import React from 'react'
import { useLocation } from 'react-router-dom'
import { CBadge, CButton, CCard, CCardBody, CCol, CContainer, CRow } from '@coreui/react'

import { DEMO_PERSONAS, enterAsPersona } from '../../../services/auth'
import { resetDemoData } from '../../../services/supabase'
import hmaLogo from '../../../assets/brand/hma-logo.png'

const RoleSelect = () => {
  const location = useLocation()
  const from = location.state?.from?.pathname || '/select-system'

  const enterAs = (persona) => {
    enterAsPersona(persona, from)
  }

  return (
    <div className="min-vh-100 bg-body-tertiary d-flex align-items-center py-5">
      <CContainer style={{ maxWidth: 1040 }}>
        <div className="text-center mb-4">
          <img src={hmaLogo} alt="HMA" height={56} className="mb-3" />
          <h2 className="mb-1">HMA IEMS — Showcase</h2>
          <p className="text-body-secondary mb-0">
            Pick a role to explore the system. All people, projects and figures are fictional.
          </p>
        </div>

        <CRow className="g-3">
          {DEMO_PERSONAS.map((persona) => (
            <CCol key={persona.id} xs={12} sm={6} lg={4}>
              <CCard
                className="h-100 border-top border-top-3"
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onClick={() => enterAs(persona)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && enterAs(persona)}
              >
                <CCardBody className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="mb-0">{persona.label}</h5>
                    <CBadge color={persona.color}>{persona.system}</CBadge>
                  </div>
                  <p className="text-body-secondary small flex-grow-1">{persona.blurb}</p>
                  <div className="small">
                    <span className="text-body-secondary">Signs in as </span>
                    <strong>{persona.user.full_name}</strong>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>

        <div className="text-center mt-4">
          <CButton color="link" size="sm" onClick={resetDemoData}>
            Reset demo data
          </CButton>
        </div>
      </CContainer>
    </div>
  )
}

export default RoleSelect
