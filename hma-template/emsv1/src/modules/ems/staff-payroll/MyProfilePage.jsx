import React, { useEffect, useState } from 'react'
import {
  CAlert,
  CCard,
  CCardBody,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'

import useAuth from '../../../hooks/useAuth'
import { localEmployees } from '../../../services/localEmployees'
import { localEmployeePhotos } from '../../../services/localEmployeePhotos'
import api from '../../../services/api'

import AddressTab from './components/AddressTab'
import GovernmentIdsTab from './components/GovernmentIdsTab'
import BankAccountTab from './components/BankAccountTab'
import FamilyTab from './components/FamilyTab'
import DocumentsTab from './components/DocumentsTab'
import AttendanceSummaryTab from './components/AttendanceSummaryTab'
import ProfilePhotoUpload from './components/ProfilePhotoUpload'

const TABS = [
  { key: 'address', label: 'Address' },
  { key: 'govids', label: 'Gov IDs' },
  { key: 'bank', label: 'Bank' },
  { key: 'family', label: 'Family' },
  { key: 'documents', label: 'Documents' },
  { key: 'attendance', label: 'Attendance' },
]

const MyProfilePage = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('address')
  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get('/employees/me')
        setProfile(data)
        if (data.photo_url) setPhoto(await localEmployeePhotos.getSignedUrl(data.photo_url))
      } catch {
        // Fall back to local store — find employee by employee_id from auth
        const empId = user?.employee_id
        if (empId) {
          // detailed: true — this fallback renders the same full profile UI as
          // the primary /employees/me path (bank_accounts, family_members,
          // address, identification all get displayed below), unlike every
          // other list() caller which only reads scalar/contact/employment fields.
          const { items } = await localEmployees.list({
            search: empId,
            pageSize: 5,
            detailed: true,
          })
          // Exact match on employee_id (search is a substring match, so confirm)
          const found = items.find((e) => e.employee_id?.toLowerCase() === empId.toLowerCase())
          if (found) {
            setProfile(found)
            if (found.photo_url) setPhoto(await localEmployeePhotos.getSignedUrl(found.photo_url))
          } else {
            setError('Your employee profile was not found. Contact HR.')
          }
        } else {
          setError('Unable to identify your employee account. Contact HR.')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error || !profile) {
    return <CAlert color="danger">{error || 'Profile not found.'}</CAlert>
  }

  const fullName =
    profile.employee_name ||
    [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')

  return (
    <>
      <h4 className="mb-4">My Profile</h4>

      <CCard>
        {/* Header — name, ID, photo (view-only) */}
        <div className="p-3 border-bottom d-flex align-items-center gap-3">
          <ProfilePhotoUpload photo={photo} name={fullName} size={56} canEdit={false} />
          <div>
            <div className="fw-semibold fs-5">{fullName}</div>
            <div className="text-body-secondary small">
              {profile.employee_id}
              {profile.employment?.designation
                ? ` · ${profile.employment.designation}`
                : profile.designation
                  ? ` · ${profile.designation}`
                  : ''}
              {profile.employment?.department || profile.department
                ? ` · ${profile.employment?.department || profile.department}`
                : ''}
            </div>
          </div>
        </div>

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
            <CTabPane visible={activeTab === 'address'}>
              <AddressTab employeeId={profile.id} address={profile.address} canEdit={false} />
            </CTabPane>
            <CTabPane visible={activeTab === 'govids'}>
              <GovernmentIdsTab
                employeeId={profile.id}
                identification={profile.identification}
                canEdit={false}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'bank'}>
              <BankAccountTab
                employeeId={profile.id}
                bankAccounts={profile.bank_accounts}
                canEdit={false}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'family'}>
              <FamilyTab
                employeeId={profile.id}
                familyMembers={profile.family_members}
                canEdit={false}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'documents'}>
              <DocumentsTab employeeId={profile.id} canEdit={false} />
            </CTabPane>
            <CTabPane visible={activeTab === 'attendance'}>
              <AttendanceSummaryTab employeeId={profile.employee_id} />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </>
  )
}

export default MyProfilePage
