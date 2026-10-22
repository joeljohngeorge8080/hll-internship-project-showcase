import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilArrowLeft,
  cilFile,
  cilMoney,
  cilPencil,
  cilPeople,
  cilSwapHorizontal,
} from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import api from '../../../services/api'
import { localEmployees } from '../../../services/localEmployees'
import { localEmployeePhotos } from '../../../services/localEmployeePhotos'

import BasicInfoTab from './components/BasicInfoTab'
import ContactTab from './components/ContactTab'
import AddressTab from './components/AddressTab'
import EmploymentTab from './components/EmploymentTab'
import GovernmentIdsTab from './components/GovernmentIdsTab'
import BankAccountTab from './components/BankAccountTab'
import FamilyTab from './components/FamilyTab'
import DocumentsTab from './components/DocumentsTab'
import SalaryTab from './components/SalaryTab'
import MonthlySalaryDetailsTab from './components/MonthlySalaryDetailsTab'
import AttendanceSummaryTab from './components/AttendanceSummaryTab'
import ChangeStatusModal from './components/ChangeStatusModal'
import ManageAccessModal from './components/ManageAccessModal'
import SalaryUpdateModal from './components/SalaryUpdateModal'
import ProfilePhotoUpload from './components/ProfilePhotoUpload'
import ProjectAssignmentSection from './components/ProjectAssignmentSection'
import EmployeeReportPanel from './components/EmployeeReportPanel'

const STATUS_COLORS = {
  Active: 'success',
  Inactive: 'secondary',
  Resigned: 'danger',
  Retired: 'warning',
  Deleted: 'dark',
}

const TABS = [
  { key: 'basic', label: 'Basic Info' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'employment', label: 'Employment' },
  { key: 'projects', label: 'Projects' },
  { key: 'govids', label: 'Gov IDs' },
  { key: 'bank', label: 'Bank' },
  { key: 'family', label: 'Family' },
  { key: 'documents', label: 'Documents' },
  { key: 'salary', label: 'Salary & Payroll' },
  { key: 'monthly_salary', label: 'Monthly Salary Details' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'report', label: 'Report' },
]

const EmployeeProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.STAFF_PAYROLL, 'edit')

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  const [showChangeStatus, setShowChangeStatus] = useState(false)
  const [showSalaryUpdate, setShowSalaryUpdate] = useState(false)
  const [showManageAccess, setShowManageAccess] = useState(false)
  const [employeeAccount, setEmployeeAccount] = useState(null)
  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/employees/${id}`)
        setProfile(data)
        if (data.photo_url) setPhoto(await localEmployeePhotos.getSignedUrl(data.photo_url))
      } catch {
        // API not available — read from local store. Wrapped in its own
        // try/catch: a genuine lookup failure here must not become an
        // unhandled rejection inside this outer catch block.
        try {
          const local = await localEmployees.getById(id)
          if (local) {
            setProfile(local)
            if (local.photo_url) setPhoto(await localEmployeePhotos.getSignedUrl(local.photo_url))
          } else {
            setError('Employee not found')
          }
        } catch (localErr) {
          setError(localErr.message || 'Employee not found')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [id])

  const openManageAccess = async () => {
    try {
      const { data } = await api.get(`/employees/${id}/account`)
      setEmployeeAccount(data)
    } catch {
      setEmployeeAccount(null)
    }
    setShowManageAccess(true)
  }

  const refreshProfile = async () => {
    try {
      const { data } = await api.get(`/employees/${id}`)
      setProfile(data)
    } catch {
      try {
        const local = await localEmployees.getById(id)
        if (local) setProfile(local)
      } catch {
        // keep showing the last-known profile rather than losing it
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !profile) {
    return <CAlert color="danger">{error || 'Employee not found'}</CAlert>
  }

  const fullName =
    profile.employee_name ||
    [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')

  // The route param can be either the internal uuid or the human-readable
  // employee_id (getById() accepts both — see localEmployees.js). Every save
  // from here down must use the resolved uuid: child tables' employee_id
  // columns are uuid FKs, so passing the business code through would 400
  // exactly like the profile fetch used to.
  const employeeUuid = profile.id || id

  return (
    <>
      <CRow className="mb-3 align-items-center">
        <CCol>
          <CButton
            color="link"
            className="ps-0 text-decoration-none"
            onClick={() => navigate('/ems/staff-payroll')}
          >
            <CIcon icon={cilArrowLeft} className="me-1" />
            Back to Staff List
          </CButton>
        </CCol>
      </CRow>

      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center g-3">
            {/* Avatar */}
            <CCol xs="auto">
              <ProfilePhotoUpload
                photo={photo}
                name={fullName}
                size={64}
                canEdit={canEdit}
                onChange={(file) => {
                  localEmployeePhotos
                    .upload(employeeUuid, file)
                    .then(setPhoto)
                    .catch(() => {
                      // silent — profile photo save failed; ProfilePhotoUpload's
                      // own local preview stays visible either way
                    })
                }}
              />
            </CCol>

            {/* Identity */}
            <CCol>
              <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                <strong className="fs-5">{fullName}</strong>
                <span className="text-body-secondary">{profile.employee_id}</span>
                <CBadge color={STATUS_COLORS[profile.status] || 'secondary'}>
                  {profile.status}
                </CBadge>
              </div>
              <div className="text-body-secondary small">
                {profile.employment?.designation || profile.designation || ''}
                {(profile.employment?.department || profile.department) &&
                  ` • ${profile.employment?.department || profile.department}`}
                {profile.employee_category && ` • ${profile.employee_category}`}
              </div>
            </CCol>

            {/* HR-only action buttons */}
            {canEdit && (
              <CCol xs="auto">
                <CButtonGroup>
                  <CButton
                    color="primary"
                    size="sm"
                    onClick={() => navigate(`/ems/staff-payroll/${employeeUuid}/edit`)}
                  >
                    <CIcon icon={cilPencil} className="me-1" />
                    Edit
                  </CButton>
                  <CButton color="warning" size="sm" onClick={() => setShowChangeStatus(true)}>
                    <CIcon icon={cilSwapHorizontal} className="me-1" />
                    Change Status
                  </CButton>
                  <CButton color="secondary" size="sm" onClick={() => setActiveTab('documents')}>
                    <CIcon icon={cilFile} className="me-1" />
                    Upload Document
                  </CButton>
                  <CButton color="success" size="sm" onClick={() => setShowSalaryUpdate(true)}>
                    <CIcon icon={cilMoney} className="me-1" />
                    Update Salary
                  </CButton>
                  <CButton color="dark" size="sm" onClick={openManageAccess}>
                    <CIcon icon={cilPeople} className="me-1" />
                    Manage Access
                  </CButton>
                </CButtonGroup>
              </CCol>
            )}
          </CRow>
        </CCardHeader>

        <CCardBody className="p-0">
          <CNav variant="tabs" className="px-3 pt-2">
            {TABS.map((tab) => (
              <CNavItem key={tab.key}>
                <CNavLink
                  active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ cursor: 'pointer' }}
                >
                  {tab.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <CTabContent className="p-3">
            <CTabPane visible={activeTab === 'basic'}>
              <BasicInfoTab profile={profile} canEdit={canEdit} onSave={refreshProfile} />
            </CTabPane>
            <CTabPane visible={activeTab === 'contact'}>
              <ContactTab
                employeeId={employeeUuid}
                contact={profile.contact}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'address'}>
              <AddressTab
                employeeId={employeeUuid}
                address={profile.address}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'employment'}>
              <EmploymentTab profile={profile} canEdit={canEdit} onSave={refreshProfile} />
            </CTabPane>
            <CTabPane visible={activeTab === 'projects'}>
              <ProjectAssignmentSection
                employeeId={employeeUuid}
                projectAssignments={profile.project_assignments || []}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'govids'}>
              <GovernmentIdsTab
                employeeId={employeeUuid}
                identification={profile.identification}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'bank'}>
              <BankAccountTab
                employeeId={employeeUuid}
                bankAccounts={profile.bank_accounts}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'family'}>
              <FamilyTab
                employeeId={employeeUuid}
                familyMembers={profile.family_members}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'documents'}>
              <DocumentsTab employeeId={employeeUuid} canEdit={canEdit} />
            </CTabPane>
            <CTabPane visible={activeTab === 'salary'}>
              <SalaryTab
                employeeId={employeeUuid}
                currentSalary={profile.current_salary}
                currentDesignation={profile.employment?.designation || ''}
                canEdit={canEdit}
                onSave={refreshProfile}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'monthly_salary'}>
              <MonthlySalaryDetailsTab
                employeeId={profile.employee_id}
                currentSalary={profile.current_salary}
                canEdit={canEdit}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'attendance'}>
              <AttendanceSummaryTab employeeId={profile.employee_id} />
            </CTabPane>
            <CTabPane visible={activeTab === 'report'}>
              <EmployeeReportPanel employee={profile} />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>

      {/* HR-only modals */}
      {canEdit && (
        <>
          <ChangeStatusModal
            visible={showChangeStatus}
            onClose={() => setShowChangeStatus(false)}
            employeeId={employeeUuid}
            employeeName={fullName}
            currentStatus={profile.status}
            onSave={refreshProfile}
            onDelete={() => navigate('/ems/staff-payroll')}
          />
          <SalaryUpdateModal
            visible={showSalaryUpdate}
            onClose={() => setShowSalaryUpdate(false)}
            employeeId={employeeUuid}
            currentSalary={profile.current_salary}
            onSave={refreshProfile}
          />
          <ManageAccessModal
            visible={showManageAccess}
            onClose={() => setShowManageAccess(false)}
            employeeId={employeeUuid}
            employeeName={fullName}
            currentAccount={employeeAccount}
          />
        </>
      )}
    </>
  )
}

export default EmployeeProfile
