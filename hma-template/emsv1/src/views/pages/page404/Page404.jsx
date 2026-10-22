import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CButton } from '@coreui/react'

const Page404 = () => {
  const navigate = useNavigate()

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center px-4"
      style={{ background: 'var(--cui-tertiary-bg)' }}
    >
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        {/* Error code */}
        <div
          style={{
            fontSize: '6rem',
            fontWeight: 800,
            lineHeight: 1,
            color: 'var(--cui-primary)',
            marginBottom: '0.75rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          404
        </div>

        <h2
          style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            color: 'var(--cui-body-color)',
            marginBottom: '0.75rem',
          }}
        >
          Page not found
        </h2>

        <p
          style={{
            color: 'var(--cui-secondary-color)',
            fontSize: '0.9375rem',
            lineHeight: 1.65,
            marginBottom: '2rem',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <CButton color="primary" onClick={() => navigate(-1)}>
            Go back
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => navigate('/select-system')}>
            Dashboard
          </CButton>
        </div>
      </div>
    </div>
  )
}

export default Page404
