import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import api from '../../../services/api'
import { localAttendance } from '../../../services/localAttendance'
import { localEmployees } from '../../../services/localEmployees'
import { computeAttendanceDeduction } from '../../../services/attendanceCalc'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const fmt = (n) =>
  Number(n).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })

const DeductionSummary = ({ year, month }) => {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/attendance/summaries?year=${year}&month=${month}`)
        setSummaries(res.data.items || [])
      } catch {
        setSummaries(await localAttendance.listMonthlySummaries({ year, month }))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year, month])

  // Build salary + name lookup keyed by employee_id text (e.g. "EMP001")
  const [empMap, setEmpMap] = useState({})
  useEffect(() => {
    let cancelled = false
    localEmployees
      .list({ pageSize: 1000 })
      .then(({ items }) => {
        if (cancelled) return
        const map = {}
        for (const emp of items) {
          map[emp.employee_id] = {
            name: emp.employee_name || [emp.first_name, emp.last_name].filter(Boolean).join(' '),
            salary: parseFloat(emp.current_salary || 0),
          }
        }
        setEmpMap(map)
      })
      .catch(() => {
        // silent
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    return summaries.map((s) => {
      const info = empMap[s.employee_id]
      const hasSalary = !!info && info.salary > 0
      const salary = info?.salary || 0

      const presentCount = s.present_count || 0 // already folds in half-day
      const absentCount = s.absent_count || 0
      const weeklyOffCount = s.weekly_off_count || 0
      const halfDayCount = s.half_day_count || 0 // already counted inside present_count
      const lateDeductionHours = s.late_deduction_hours || 0
      const earlyDeductionHours = s.early_deduction_hours || 0
      const workingDays = presentCount + absentCount + weeklyOffCount

      const {
        dailySalary: perDayRate,
        absentDeduction,
        halfDayDeduction,
        lateDeduction,
        earlyDeduction,
        totalDeduction,
        netPayable,
      } = hasSalary
        ? computeAttendanceDeduction({
            salary,
            presentCount,
            absentCount,
            weeklyOffCount,
            halfDayCount,
            lateDeductionHours,
            earlyDeductionHours,
          })
        : {
            dailySalary: 0,
            absentDeduction: 0,
            halfDayDeduction: 0,
            lateDeduction: 0,
            earlyDeduction: 0,
            totalDeduction: 0,
            netPayable: 0,
          }

      return {
        key: s.id || s.employee_id,
        employee_id: s.employee_id,
        name: info?.name || '—',
        hasSalary,
        salary,
        workingDays,
        perDayRate,
        halfDayCount,
        absentCount,
        lateDeductionHours,
        earlyDeductionHours,
        absentDeduction,
        halfDayDeduction,
        lateDeduction,
        earlyDeduction,
        totalDeduction,
        netPayable,
      }
    })
  }, [summaries, empMap])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          salary: acc.salary + r.salary,
          absentDeduction: acc.absentDeduction + r.absentDeduction,
          halfDayDeduction: acc.halfDayDeduction + r.halfDayDeduction,
          lateDeduction: acc.lateDeduction + r.lateDeduction,
          earlyDeduction: acc.earlyDeduction + r.earlyDeduction,
          totalDeduction: acc.totalDeduction + r.totalDeduction,
          netPayable: r.hasSalary ? acc.netPayable + r.netPayable : acc.netPayable,
        }),
        {
          salary: 0,
          absentDeduction: 0,
          halfDayDeduction: 0,
          lateDeduction: 0,
          earlyDeduction: 0,
          totalDeduction: 0,
          netPayable: 0,
        },
      ),
    [rows],
  )

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-body-secondary mt-3">
        No attendance data for {MONTHS[month - 1]} {year}. Import attendance to calculate
        deductions.
      </p>
    )
  }

  return (
    <>
      {/* Summary strip */}
      <CRow className="g-3 mb-4">
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-primary border-3 h-100">
            <CCardBody className="text-center py-3">
              <div className="fs-6 fw-bold text-primary">{fmt(totals.salary)}</div>
              <div className="small text-body-secondary mt-1">Total Gross Salary</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-danger border-3 h-100">
            <CCardBody className="text-center py-3">
              <div className="fs-6 fw-bold text-danger">{fmt(totals.totalDeduction)}</div>
              <div className="small text-body-secondary mt-1">Total Deductions</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-success border-3 h-100">
            <CCardBody className="text-center py-3">
              <div className="fs-6 fw-bold text-success">{fmt(totals.netPayable)}</div>
              <div className="small text-body-secondary mt-1">Net Payable</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-secondary border-3 h-100">
            <CCardBody className="text-center py-3">
              <div className="fs-5 fw-bold">{rows.length}</div>
              <div className="small text-body-secondary mt-1">Employees</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <p className="text-body-secondary small mb-3">
        <strong>Per-day rate</strong> = monthly salary ÷ (present + absent + weekly-off days).&nbsp;{' '}
        <strong>Absent deduction</strong> = absent days × per-day rate.&nbsp;
        <strong>Half-day deduction</strong> = half-day count × 4 × hourly rate (&gt;120 min late or
        early-out).&nbsp; <strong>Late deduction</strong> = bracket rate for late days beyond the 7
        free units (30/60/90/120 min → 0.5/1/1.5/2 hrs).&nbsp; <strong>Early-out deduction</strong>{' '}
        = bracket rate for early-out days beyond the 60 free minutes (60/120 min early → 1/2
        hrs).&nbsp; Paid leave (CL/SL/OD/COFF) is not deducted. Employees with no salary on file
        show &ldquo;-&rdquo;.
      </p>

      <CCard>
        <CCardHeader>
          <strong>
            Deduction Details — {MONTHS[month - 1]} {year}
          </strong>
        </CCardHeader>
        <CCardBody className="p-0">
          <CTable hover responsive small className="mb-0">
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell>Emp ID</CTableHeaderCell>
                <CTableHeaderCell>Name</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Gross Salary</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Working Days (P+A)</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Per-Day Rate</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Absent</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Absent Ded.</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Half Days</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Half-Day Ded.</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Late Ded.</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Early-Out Ded.</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-danger">Total Ded.</CTableHeaderCell>
                <CTableHeaderCell className="text-end text-success">Net Payable</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((r) => (
                <CTableRow key={r.key}>
                  <CTableDataCell className="fw-semibold">{r.employee_id}</CTableDataCell>
                  <CTableDataCell>{r.name}</CTableDataCell>
                  <CTableDataCell className="text-end">
                    {r.hasSalary ? fmt(r.salary) : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    {r.hasSalary ? r.workingDays : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end small text-body-secondary">
                    {r.hasSalary ? fmt(r.perDayRate) : '-'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    {r.absentCount > 0 ? (
                      <span className="text-danger fw-semibold">{r.absentCount}</span>
                    ) : (
                      <span className="text-body-secondary">0</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-end text-danger">
                    {!r.hasSalary ? '-' : r.absentDeduction > 0 ? fmt(r.absentDeduction) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    {r.halfDayCount > 0 ? (
                      <span className="text-warning fw-semibold">{r.halfDayCount}</span>
                    ) : (
                      <span className="text-body-secondary">0</span>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-end text-danger">
                    {!r.hasSalary ? '-' : r.halfDayDeduction > 0 ? fmt(r.halfDayDeduction) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end text-danger">
                    {!r.hasSalary ? '-' : r.lateDeduction > 0 ? fmt(r.lateDeduction) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end text-danger">
                    {!r.hasSalary ? '-' : r.earlyDeduction > 0 ? fmt(r.earlyDeduction) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-semibold text-danger">
                    {!r.hasSalary ? '-' : r.totalDeduction > 0 ? fmt(r.totalDeduction) : '—'}
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-bold text-success">
                    {r.hasSalary ? fmt(r.netPayable) : '-'}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
            <CTableFoot color="light">
              <CTableRow className="fw-bold">
                <CTableDataCell colSpan={2}>Total</CTableDataCell>
                <CTableDataCell className="text-end">{fmt(totals.salary)}</CTableDataCell>
                <CTableDataCell />
                <CTableDataCell />
                <CTableDataCell />
                <CTableDataCell className="text-end text-danger">
                  {fmt(totals.absentDeduction)}
                </CTableDataCell>
                <CTableDataCell />
                <CTableDataCell className="text-end text-danger">
                  {fmt(totals.halfDayDeduction)}
                </CTableDataCell>
                <CTableDataCell className="text-end text-danger">
                  {fmt(totals.lateDeduction)}
                </CTableDataCell>
                <CTableDataCell className="text-end text-danger">
                  {fmt(totals.earlyDeduction)}
                </CTableDataCell>
                <CTableDataCell className="text-end text-danger">
                  {fmt(totals.totalDeduction)}
                </CTableDataCell>
                <CTableDataCell className="text-end text-success">
                  {fmt(totals.netPayable)}
                </CTableDataCell>
              </CTableRow>
            </CTableFoot>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

DeductionSummary.propTypes = {
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired,
}

export default DeductionSummary
