import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CProgress, CRow, CCol } from '@coreui/react'
import { localAttendance } from '../../../../services/localAttendance'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const AttendanceSummaryWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      // present_count/absent_count/late_days/leave_count are buildSummary()'s
      // actual field names (localAttendance.js) — this previously read
      // present_days/absent_days/late_count/leave_days, which buildSummary
      // never produced, so every total here was always 0.
      const summaries = await localAttendance.listMonthlySummaries({ year, month })
      if (cancelled) return

      if (summaries.length === 0) {
        setData(null)
        return
      }

      const totals = summaries.reduce(
        (acc, s) => ({
          present: acc.present + (s.present_count || 0),
          absent: acc.absent + (s.absent_count || 0),
          late: acc.late + (s.late_days || 0),
          leave: acc.leave + (s.leave_count || 0),
        }),
        { present: 0, absent: 0, late: 0, leave: 0 },
      )

      const total = totals.present + totals.absent + totals.leave
      setData({ ...totals, total, month, year })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-1 small text-uppercase text-body-secondary">Attendance</h6>
        {data ? (
          <>
            <div className="text-body-secondary mb-3" style={{ fontSize: '0.75rem' }}>
              {MONTHS[data.month - 1]} {data.year} — {data.total} employee-days
            </div>
            <CRow className="g-2 mb-3">
              {[
                { label: 'Present', value: data.present, color: '#06d6a0' },
                { label: 'Absent', value: data.absent, color: '#ef476f' },
                { label: 'Late', value: data.late, color: '#f77f00' },
                { label: 'On Leave', value: data.leave, color: '#4361ee' },
              ].map((item) => (
                <CCol xs={6} key={item.label}>
                  <div
                    className="rounded-3 text-center py-2"
                    style={{ background: `${item.color}12` }}
                  >
                    <div className="fw-bold fs-5" style={{ color: item.color }}>
                      {item.value}
                    </div>
                    <div className="small text-body-secondary">{item.label}</div>
                  </div>
                </CCol>
              ))}
            </CRow>
            {data.total > 0 && (
              <CProgress
                value={Math.round((data.present / data.total) * 100)}
                height={6}
                color="success"
                className="rounded-pill"
              />
            )}
            {data.total > 0 && (
              <div className="text-body-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                {Math.round((data.present / data.total) * 100)}% attendance rate
              </div>
            )}
          </>
        ) : (
          <div className="text-body-secondary small py-3 text-center">
            No attendance data for this month
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default AttendanceSummaryWidget
