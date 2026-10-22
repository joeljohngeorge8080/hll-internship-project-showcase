import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBuilding, cilFolder } from '@coreui/icons'

import hmaLogo from 'src/assets/brand/hma-logo.png'
import useAuth from 'src/hooks/useAuth'
import { roleDisplayName } from 'src/constants/roles'

const SystemSelection = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="hma-sysselect__bg">
      {/* Perspective grid */}
      <div className="hma-sysselect__grid" aria-hidden="true" />

      {/* Brand */}
      <div className="hma-sysselect__brand">
        <img src={hmaLogo} alt="HMA" className="hma-sysselect__logo" />
        <h1 className="hma-sysselect__title">HMA Systems</h1>
        <p className="hma-sysselect__subtitle">Select a system to continue</p>
      </div>

      {/* Cards */}
      <div className="hma-sysselect__cards">
        {/* EMS */}
        <div
          role="button"
          tabIndex={0}
          className="hma-sysselect__card hma-sysselect__card--ems"
          onClick={() => navigate('/ems/dashboard')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/ems/dashboard')}
        >
          <div
            className="hma-sysselect__icon-wrap"
            style={{ background: 'rgba(37, 99, 235, 0.1)' }}
          >
            <CIcon icon={cilBuilding} style={{ width: 28, height: 28, color: '#60a5fa' }} />
          </div>
          <div className="hma-sysselect__card-title">Expense</div>
          <div className="hma-sysselect__card-desc">
            Staff, Payroll, Attendance &amp; Finance
          </div>
          <CButton
            color="primary"
            className="w-100"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/ems/dashboard')
            }}
          >
            Enter Expense
          </CButton>
        </div>

        {/* PMS */}
        <div
          role="button"
          tabIndex={0}
          className="hma-sysselect__card hma-sysselect__card--pms"
          onClick={() => navigate('/pms/dashboard')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/pms/dashboard')}
        >
          <div
            className="hma-sysselect__icon-wrap"
            style={{ background: 'rgba(16, 185, 129, 0.1)' }}
          >
            <CIcon icon={cilFolder} style={{ width: 28, height: 28, color: '#34d399' }} />
          </div>
          <div className="hma-sysselect__card-title">Projects</div>
          <div className="hma-sysselect__card-desc">
            Projects, Lifecycle, Expenses &amp; Reports
          </div>
          <CButton
            color="success"
            className="w-100"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/pms/dashboard')
            }}
          >
            Enter Projects
          </CButton>
        </div>
      </div>

      {/* Signed-in as */}
      {user && (
        <div className="hma-sysselect__user">
          <span>Signed in as</span>
          <strong style={{ color: 'rgba(203, 213, 225, 0.65)' }}>
            {user.full_name || user.google_email}
          </strong>
          {user.role && (
            <span
              style={{
                background: 'rgba(37, 99, 235, 0.18)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: 6,
                padding: '1px 7px',
                fontSize: '0.6875rem',
                color: '#93c5fd',
                fontWeight: 600,
              }}
            >
              {roleDisplayName(user.role)}
            </span>
          )}
        </div>
      )}

      <div className="hma-sysselect__footer">HMA Internal Enterprise Management System</div>
    </div>
  )
}

export default SystemSelection
