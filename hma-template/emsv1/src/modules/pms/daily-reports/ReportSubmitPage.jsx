/**
 * ReportSubmitPage — New daily report submission page.
 *
 * Route: /pms/daily-reports/new
 * Supports ?task=<taskId> query param to pre-select a task.
 */
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CRow, CCol, CToaster, CToast, CToastBody, CToastClose } from '@coreui/react'

import ReportForm from './components/ReportForm'
import { localReports } from '../../../services/localReports'

const ReportSubmitPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const handleSubmit = useCallback(
    async (data) => {
      setLoading(true)
      try {
        await localReports.create(data)
        setToast({ color: 'success', message: 'Report submitted successfully' })
        setTimeout(() => navigate('/pms/daily-reports/history'), 1200)
      } catch (err) {
        setToast({ color: 'danger', message: err.message || 'Failed to submit' })
        setLoading(false)
      }
    },
    [navigate],
  )

  const handleSaveDraft = useCallback(async (data) => {
    try {
      await localReports.saveDraft(data)
      setToast({ color: 'info', message: 'Draft saved' })
    } catch (err) {
      setToast({ color: 'danger', message: err.message || 'Failed to save draft' })
    }
  }, [])

  return (
    <>
      <CRow className="justify-content-center">
        <CCol xs={12} lg={8} xl={7}>
          <ReportForm onSubmit={handleSubmit} onSaveDraft={handleSaveDraft} loading={loading} />
        </CCol>
      </CRow>

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3000}
            visible
            color={toast.color}
            className="text-white"
            onClose={() => setToast(null)}
          >
            <div className="d-flex">
              <CToastBody>{toast.message}</CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        )}
      </CToaster>
    </>
  )
}

export default ReportSubmitPage
