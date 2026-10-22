/**
 * ReportEditPage — Resubmission page for declined reports.
 *
 * Route: /pms/daily-reports/:id/edit
 * Pre-populates ReportForm with declined report data.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CSpinner,
  CAlert,
  CButton,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
} from '@coreui/react'

import ReportForm from './components/ReportForm'
import { localReports, REPORT_STATUS } from '../../../services/localReports'

const ReportEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    localReports.getById(id).then((r) => {
      if (cancelled) return
      if (!r) {
        setError('Report not found')
      } else if (r.status !== REPORT_STATUS.DECLINED && r.status !== REPORT_STATUS.DRAFT) {
        setError('Only declined or draft reports can be edited')
      } else {
        setReport(r)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const handleSubmit = useCallback(
    async (data) => {
      setSubmitting(true)
      try {
        if (report.status === REPORT_STATUS.DRAFT) {
          await localReports.create({ ...data, id: report.id })
        } else {
          await localReports.resubmit(report.id, data)
        }
        setToast({ color: 'success', message: 'Report resubmitted successfully' })
        setTimeout(() => navigate('/pms/daily-reports/history'), 1200)
      } catch (err) {
        setToast({ color: 'danger', message: err.message || 'Failed to resubmit' })
        setSubmitting(false)
      }
    },
    [report, navigate],
  )

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error) {
    return (
      <>
        <CAlert color="danger">{error}</CAlert>
        <CButton color="primary" variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </CButton>
      </>
    )
  }

  return (
    <>
      <CRow className="justify-content-center">
        <CCol xs={12} lg={8} xl={7}>
          <ReportForm
            defaultValues={report}
            isResubmit={report.status === REPORT_STATUS.DECLINED}
            declineReason={report.decline_reason}
            onSubmit={handleSubmit}
            loading={submitting}
          />
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

export default ReportEditPage
