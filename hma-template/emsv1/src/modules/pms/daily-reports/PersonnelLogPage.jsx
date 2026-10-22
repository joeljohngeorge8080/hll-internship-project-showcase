/**
 * PersonnelLogPage — Field Personnel unified dashboard.
 *
 * Route: /pms/daily-reports/personnel-log
 * Groups active tasks and submitted reports by project.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CBadge,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CProgress,
  CAlert,
  CForm,
  CFormSelect,
  CFormInput,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBuilding,
  cilTask,
  cilFile,
  cilPlus,
  cilUser,
  cilCloudUpload,
  cilNotes,
} from '@coreui/icons'

import TaskCard from './components/TaskCard'
import ReportCard from './components/ReportCard'
import { localTasks } from '../../../services/localTasks'
import { localReports } from '../../../services/localReports'
import { roleDisplayName } from '../../../constants/roles'

const PersonnelLogPage = () => {
  const navigate = useNavigate()

  // Hardcoded for demo - in real app, get from auth context
  const currentUser = { id: 'fp_001', name: 'Rajesh Kumar', role: 'Field Personnel' }

  const [activeTab, setActiveTab] = useState(0)
  const [tasks, setTasks] = useState([])
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [proofForm, setProofForm] = useState({ taskId: '', file: null })

  const loadData = useCallback(async () => {
    // Seed demo data first
    localTasks.seedDemoData()
    await localReports.seedDemoData()

    // Load data for current user
    const userTasks = localTasks.getByAssignee(currentUser.id)
    const userReportsResult = await localReports.list({ personnel: currentUser.id, pageSize: 100 })

    setTasks(userTasks)
    setReports(userReportsResult.items)

    // Extract unique projects from tasks
    const projectMap = new Map()
    userTasks.forEach((t) => {
      const pName = t.project_name || 'General Project'
      if (!projectMap.has(pName)) {
        projectMap.set(pName, {
          name: pName,
          activeTasks: 0,
          completedTasks: 0,
          reportsCount: 0,
          fundBalance: 250000 + Math.floor(Math.random() * 500000),
        })
      }
      if (t.status === 'active') projectMap.get(pName).activeTasks++
      if (t.status === 'completed') projectMap.get(pName).completedTasks++
    })

    // Count reports per project (matching by task_title mapping to project)
    userReportsResult.items.forEach((r) => {
      // Find associated task to get project name
      const task = userTasks.find((t) => t.id === r.task_id || t.title === r.task_title)
      const pName = task?.project_name || 'General Project'

      if (!projectMap.has(pName)) {
        projectMap.set(pName, {
          name: pName,
          activeTasks: 0,
          completedTasks: 0,
          reportsCount: 1,
          fundBalance: 250000 + Math.floor(Math.random() * 500000),
        })
      } else {
        projectMap.get(pName).reportsCount++
      }
    })

    setProjects(Array.from(projectMap.values()))
  }, [currentUser.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmitReport = (taskId) => {
    navigate(`/pms/daily-reports/new?task=${taskId}`)
  }

  const handleReportClick = (id) => {
    navigate(`/pms/daily-reports/history`) // Or direct to edit if declined
  }

  return (
    <>
      {/* Header Profile Section */}
      <CCard className="mb-4 border-0 shadow-sm overflow-hidden">
        <div className="bg-primary pt-4 pb-5 px-4 text-white">
          <div className="d-flex align-items-center gap-3">
            <div
              className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: '60px', height: '60px' }}
            >
              <CIcon icon={cilUser} size="xl" />
            </div>
            <div>
              <h3 className="mb-0 fw-bold">{currentUser.name}</h3>
              <div className="opacity-75">{roleDisplayName(currentUser.role)}</div>
            </div>
          </div>
        </div>
        <CCardBody className="pt-0 position-relative">
          <CRow className="g-3" style={{ marginTop: '-2rem' }}>
            {/* Summary Cards */}
            <CCol xs={4}>
              <CCard className="h-100 shadow-sm border-0 text-center py-2">
                <div className="fs-3 fw-bold text-primary">{projects.length}</div>
                <div
                  className="small text-body-secondary text-uppercase fw-semibold"
                  style={{ fontSize: '0.7rem' }}
                >
                  Active Projects
                </div>
              </CCard>
            </CCol>
            <CCol xs={4}>
              <CCard className="h-100 shadow-sm border-0 text-center py-2">
                <div className="fs-3 fw-bold text-warning">
                  {tasks.filter((t) => t.status === 'active').length}
                </div>
                <div
                  className="small text-body-secondary text-uppercase fw-semibold"
                  style={{ fontSize: '0.7rem' }}
                >
                  Pending Tasks
                </div>
              </CCard>
            </CCol>
            <CCol xs={4}>
              <CCard className="h-100 shadow-sm border-0 text-center py-2">
                <div className="fs-3 fw-bold text-success">{reports.length}</div>
                <div
                  className="small text-body-secondary text-uppercase fw-semibold"
                  style={{ fontSize: '0.7rem' }}
                >
                  Reports Logged
                </div>
              </CCard>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Main Content Area */}
      <CRow className="g-4">
        {/* Left Column: Project Context */}
        <CCol xs={12} lg={4}>
          <h5 className="fw-semibold mb-3">My Projects</h5>
          {projects.length === 0 ? (
            <CAlert color="info">You are not assigned to any projects currently.</CAlert>
          ) : (
            <div className="d-flex flex-column gap-3">
              {projects.map((proj, idx) => {
                const totalTasks = proj.activeTasks + proj.completedTasks
                const progress =
                  totalTasks > 0 ? Math.round((proj.completedTasks / totalTasks) * 100) : 0

                return (
                  <CCard key={idx} className="shadow-sm border-top border-3 border-top-primary">
                    <CCardBody>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <div className="p-2 bg-primary-subtle text-primary rounded">
                          <CIcon icon={cilBuilding} />
                        </div>
                        <h6 className="mb-0 fw-semibold text-truncate">{proj.name}</h6>
                      </div>
                      <div className="mt-3">
                        <div className="d-flex justify-content-between small text-body-secondary mb-1">
                          <span>Task Progress</span>
                          <span className="fw-medium">{progress}%</span>
                        </div>
                        <CProgress value={progress} color="success" height={6} className="mb-3" />
                        <div className="mb-3 d-flex justify-content-between align-items-center bg-body-tertiary p-2 rounded">
                          <span className="small text-body-secondary">Fund Balance:</span>
                          <span className="fw-bold text-success">
                            ₹{proj.fundBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between text-center border-top pt-2">
                        <div className="px-2">
                          <div className="fs-5 fw-bold text-body">{proj.activeTasks}</div>
                          <div className="small text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            Tasks
                          </div>
                        </div>
                        <div className="px-2 border-start">
                          <div className="fs-5 fw-bold text-body">{proj.reportsCount}</div>
                          <div className="small text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            Reports
                          </div>
                        </div>
                      </div>
                    </CCardBody>
                  </CCard>
                )
              })}
            </div>
          )}

          <CButton
            color="primary"
            className="w-100 mt-3 shadow-sm mb-4"
            onClick={() => navigate('/pms/daily-reports/new')}
          >
            <CIcon icon={cilPlus} className="me-2" />
            Submit New Report
          </CButton>

          <CCard className="shadow-sm border-top border-3 border-top-warning">
            <CCardHeader className="pb-0 border-bottom">
              <h6 className="fw-semibold mb-3">Upload Task Proof</h6>
            </CCardHeader>
            <CCardBody>
              <CForm
                onSubmit={(e) => {
                  e.preventDefault()
                  if (proofForm.taskId && proofForm.file) {
                    alert('Task proof uploaded successfully!')
                    setProofForm({ taskId: '', file: null })
                    document.getElementById('proofFileInput').value = ''
                  }
                }}
              >
                <div className="mb-3">
                  <CFormSelect
                    size="sm"
                    value={proofForm.taskId}
                    onChange={(e) => setProofForm({ ...proofForm, taskId: e.target.value })}
                    required
                  >
                    <option value="">Select Pending Task</option>
                    {tasks
                      .filter((t) => t.status === 'active')
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </CFormSelect>
                </div>
                <div className="mb-3">
                  <CFormInput
                    id="proofFileInput"
                    type="file"
                    size="sm"
                    accept="image/*,video/*"
                    onChange={(e) => setProofForm({ ...proofForm, file: e.target.files[0] })}
                    required
                  />
                  <div className="form-text" style={{ fontSize: '0.7rem' }}>
                    Upload images or videos
                  </div>
                </div>
                <CButton
                  color="warning"
                  type="submit"
                  size="sm"
                  className="w-100 text-white fw-medium"
                >
                  <CIcon icon={cilCloudUpload} className="me-2" />
                  Submit Proof
                </CButton>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Right Column: Timeline / Activity */}
        <CCol xs={12} lg={8}>
          <CCard className="shadow-sm h-100">
            <CCardHeader className="bg-transparent pb-0 border-bottom-0">
              <CNav variant="underline" role="tablist">
                <CNavItem>
                  <CNavLink
                    active={activeTab === 0}
                    onClick={() => setActiveTab(0)}
                    role="button"
                    className="fw-medium"
                  >
                    <CIcon icon={cilTask} className="me-2" />
                    Active Tasks
                    {tasks.filter((t) => t.status === 'active').length > 0 && (
                      <CBadge color="danger" shape="rounded-pill" className="ms-2">
                        {tasks.filter((t) => t.status === 'active').length}
                      </CBadge>
                    )}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 1}
                    onClick={() => setActiveTab(1)}
                    role="button"
                    className="fw-medium"
                  >
                    <CIcon icon={cilFile} className="me-2" />
                    Recent Reports
                  </CNavLink>
                </CNavItem>
              </CNav>
            </CCardHeader>
            <CCardBody className="bg-body-tertiary pt-4">
              <CTabContent>
                {/* Active Tasks Tab */}
                <CTabPane role="tabpanel" visible={activeTab === 0}>
                  {tasks.filter((t) => t.status === 'active').length === 0 ? (
                    <div className="text-center py-5">
                      <div className="text-body-tertiary mb-2"></div>
                      <h6 className="text-body-secondary">All caught up!</h6>
                      <p className="text-body-tertiary small">
                        You have no active tasks at the moment.
                      </p>
                    </div>
                  ) : (
                    tasks
                      .filter((t) => t.status === 'active')
                      .map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          showActions
                          showAssignee={false}
                          onSubmitReport={handleSubmitReport}
                        />
                      ))
                  )}
                </CTabPane>

                {/* Recent Reports Tab */}
                <CTabPane role="tabpanel" visible={activeTab === 1}>
                  {reports.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="text-body-tertiary mb-2">
                        <CIcon icon={cilNotes} style={{ width: 36, height: 36 }} />
                      </div>
                      <h6 className="text-body-secondary">No reports yet</h6>
                      <p className="text-body-tertiary small">
                        Submit your first daily report to see it here.
                      </p>
                      <CButton
                        color="primary"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/pms/daily-reports/new')}
                      >
                        Submit Report
                      </CButton>
                    </div>
                  ) : (
                    reports.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        onClick={handleReportClick}
                        showPersonnel={false}
                      />
                    ))
                  )}
                </CTabPane>
              </CTabContent>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default PersonnelLogPage
