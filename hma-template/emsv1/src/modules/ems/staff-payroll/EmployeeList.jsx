import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilPlus, cilSearch, cilUser } from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localEmployees } from '../../../services/localEmployees'
import { computeCTC } from './ctcUtils'
import { DEPARTMENTS } from '../../../constants/employeeConstants'
import ConsolidatedReportModal from './components/ConsolidatedReportModal'

const STATUS_COLORS = {
  Active: 'success',
  Inactive: 'secondary',
  Resigned: 'danger',
  Retired: 'warning',
  Deleted: 'dark',
}

const EmployeeList = () => {
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.STAFF_PAYROLL, 'edit')

  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [page, setPage] = useState(1)
  const [showReportModal, setShowReportModal] = useState(false)
  const PAGE_SIZE = 25

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await localEmployees.list({
          search,
          status: filterStatus,
          department: filterDept,
          category: filterCategory,
          page,
          pageSize: PAGE_SIZE,
        })
        setEmployees(result.items)
        setTotal(result.total)
        setTotalPages(result.total_pages)
      } catch (err) {
        setError('Failed to load employees.')
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [page, search, filterStatus, filterDept, filterCategory])

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const hasFilters = search || filterStatus || filterDept || filterCategory

  return (
    <>
      {/* Page header */}
      <div className="d-flex align-items-start justify-content-between mb-4 gap-3">
        <div>
          <h4 className="fw-semibold mb-1">Staff &amp; Payroll</h4>
          <p className="text-body-secondary small mb-0">
            {total > 0
              ? `${total} employee${total !== 1 ? 's' : ''}`
              : 'Manage employee records and payroll information'}
          </p>
        </div>
        {canEdit && (
          <div className="d-flex gap-2">
            <CButton color="secondary" variant="outline" onClick={() => setShowReportModal(true)}>
              <CIcon icon={cilCloudDownload} className="me-1" />
              Generate Report
            </CButton>
            <CButton color="primary" onClick={() => navigate('/ems/staff-payroll/new')}>
              <CIcon icon={cilPlus} className="me-1" />
              Add Employee
            </CButton>
          </div>
        )}
      </div>

      <CCard>
        <CCardBody>
          {/* Filters */}
          <CRow className="g-2 mb-4">
            <CCol md={5}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilSearch} />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search by name or employee ID…"
                  value={search}
                  onChange={handleSearchChange}
                />
              </CInputGroup>
            </CCol>
            <CCol md={2}>
              <CFormSelect
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Status</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Resigned</option>
                <option>Retired</option>
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormSelect
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={2}>
              <CFormSelect
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Categories</option>
                <option value="Permanent">Permanent</option>
                <option value="FTC">FTC</option>
                <option value="TPC">Third Party</option>
              </CFormSelect>
            </CCol>
          </CRow>

          {error && <p className="text-danger small mb-3">{error}</p>}

          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
            </div>
          ) : (
            <>
              <CTable hover responsive className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 48 }}>#</CTableHeaderCell>
                    <CTableHeaderCell>Employee ID</CTableHeaderCell>
                    <CTableHeaderCell>Name</CTableHeaderCell>
                    <CTableHeaderCell>Roles</CTableHeaderCell>
                    <CTableHeaderCell>Designation</CTableHeaderCell>
                    <CTableHeaderCell>Department</CTableHeaderCell>
                    <CTableHeaderCell>Category</CTableHeaderCell>
                    <CTableHeaderCell>Gender</CTableHeaderCell>
                    <CTableHeaderCell>Basic Salary</CTableHeaderCell>
                    <CTableHeaderCell>Ideal CTC</CTableHeaderCell>
                    <CTableHeaderCell>Joined</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {employees.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={12}>
                        <div className="hma-empty-state">
                          <CIcon icon={cilUser} className="hma-empty-state__icon" />
                          <p className="hma-empty-state__title">
                            {hasFilters ? 'No matching employees' : 'No employees yet'}
                          </p>
                          <p className="hma-empty-state__desc">
                            {hasFilters
                              ? 'Try adjusting your search or filter criteria.'
                              : 'Add employees to get started.'}
                          </p>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ) : (
                    employees.map((emp, idx) => {
                      const name =
                        emp.employee_name ||
                        [emp.first_name, emp.middle_name, emp.last_name]
                          .filter(Boolean)
                          .join(' ') ||
                        emp.full_name ||
                        '—'
                      const designation = emp.employment?.designation || emp.designation || '—'
                      const designationText = emp.employment?.designation_text || '—'
                      const department = emp.employment?.department || emp.department || '—'
                      const salary = parseFloat(emp.current_salary || 0)

                      // Ideal CTC at full attendance (tnd = tndw = 30)
                      const ctcCalc =
                        salary > 0 ? computeCTC({ idealBasic: salary, tnd: 30, tndw: 30 }) : null
                      const idealCTC = ctcCalc?.ctc || 0

                      return (
                        <CTableRow
                          key={emp.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/ems/staff-payroll/${emp.id}`)}
                        >
                          <CTableDataCell className="text-body-secondary">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </CTableDataCell>
                          <CTableDataCell className="fw-semibold text-primary">
                            {emp.employee_id}
                          </CTableDataCell>
                          <CTableDataCell>{name}</CTableDataCell>
                          <CTableDataCell>{designation}</CTableDataCell>
                          <CTableDataCell>{designationText}</CTableDataCell>
                          <CTableDataCell>{department}</CTableDataCell>
                          <CTableDataCell>{emp.employee_category || '—'}</CTableDataCell>
                          <CTableDataCell>{emp.gender || '—'}</CTableDataCell>
                          <CTableDataCell className="fw-semibold">
                            {salary > 0
                              ? `₹${salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </CTableDataCell>
                          <CTableDataCell className="fw-semibold text-success">
                            {idealCTC > 0
                              ? `₹${idealCTC.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </CTableDataCell>
                          <CTableDataCell className="text-body-secondary">
                            {emp.joined_date || emp.employment?.start_date || '—'}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={STATUS_COLORS[emp.status] || 'secondary'}>
                              {emp.status}
                            </CBadge>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })
                  )}
                </CTableBody>
              </CTable>

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                  <small className="text-body-secondary">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                    {total}
                  </small>
                  <CPagination size="sm">
                    <CPaginationItem disabled={page === 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </CPaginationItem>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                      <CPaginationItem key={p} active={p === page} onClick={() => setPage(p)}>
                        {p}
                      </CPaginationItem>
                    ))}
                    <CPaginationItem
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </CPaginationItem>
                  </CPagination>
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {canEdit && (
        <ConsolidatedReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          filters={{
            search,
            status: filterStatus,
            department: filterDept,
            category: filterCategory,
          }}
        />
      )}
    </>
  )
}

export default EmployeeList
