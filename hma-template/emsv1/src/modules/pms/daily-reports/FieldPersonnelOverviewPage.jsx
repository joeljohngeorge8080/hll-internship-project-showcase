import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CListGroup,
  CListGroupItem,
  CBadge,
  CButton,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilUser, cilTask, cilFile } from '@coreui/icons'

import { localProjects } from '../../../services/localProjects'
import { FIELD_PERSONNEL_LIST, localTasks } from '../../../services/localTasks'
import { localReports, REPORT_STATUS } from '../../../services/localReports'
import TaskCard from './components/TaskCard'
import ReportCard from './components/ReportCard'

const OFFICER_ID = 'po_001'

const FieldPersonnelOverviewPage = () => {
  const navigate = useNavigate()

  const [selectedPersonnel, setSelectedPersonnel] = useState(null)
  const [tasks, setTasks] = useState([])
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])

  useEffect(() => {
    let cancelled = false
    // Ensure demo data is loaded
    localProjects.seedDemoData()
    localProjects.getByOfficer(OFFICER_ID).then(async (myProjects) => {
      if (cancelled) return
      setProjects(myProjects)
      localTasks.seedDemoData(myProjects)
      await localReports.seedDemoData()
      if (cancelled) return

      // Pre-load data for all personnel
      setTasks(localTasks.list({ pageSize: 500 }).items)
      setReports((await localReports.list({ pageSize: 500 })).items)

      // Select first personnel by default if on desktop
      if (window.innerWidth >= 992 && FIELD_PERSONNEL_LIST.length > 0) {
        setSelectedPersonnel(FIELD_PERSONNEL_LIST[0])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Helper to find all tasks visible to a specific personnel based on their project memberships
  const getTasksForPersonnel = useCallback((email) => {
    return localTasks.getVisibleToEmail(email, projects)
  }, [projects])

  const personnelStats = useMemo(() => {
    return FIELD_PERSONNEL_LIST.map((fp) => {
      const activeTasks = getTasksForPersonnel(fp.email)
      const pendingReports = reports.filter(
        (r) =>
          r.submitted_by === fp.id &&
          (r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED),
      )
      return {
        ...fp,
        activeTasksCount: activeTasks.length,
        pendingReportsCount: pendingReports.length,
      }
    })
  }, [getTasksForPersonnel, reports])

  const selectedTasks = useMemo(() => {
    if (!selectedPersonnel) return []
    return getTasksForPersonnel(selectedPersonnel.email)
  }, [getTasksForPersonnel, selectedPersonnel])

  const selectedReports = useMemo(() => {
    if (!selectedPersonnel) return []
    return reports.filter(
      (r) =>
        r.submitted_by === selectedPersonnel.id &&
        (r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED),
    )
  }, [reports, selectedPersonnel])

  return (
    <>
      <div className="d-flex justify-content-between align-items-end mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">My Team</h4>
          <div className="text-body-secondary small">
            Overview of Field Personnel and their current workload
          </div>
        </div>
      </div>

      <CRow className="g-4">
        {/* Left Column: Personnel List */}
        <CCol xs={12} lg={4}>
          <CCard className="shadow-sm border-0 h-100">
            <CCardHeader className="bg-transparent fw-semibold pt-3 pb-2">
              Field Personnel ({FIELD_PERSONNEL_LIST.length})
            </CCardHeader>
            <CListGroup flush>
              {personnelStats.map((fp) => (
                <CListGroupItem
                  key={fp.id}
                  component="button"
                  active={selectedPersonnel?.id === fp.id}
                  onClick={() => setSelectedPersonnel(fp)}
                  className="d-flex justify-content-between align-items-center py-3 border-bottom"
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className={`rounded-circle d-flex align-items-center justify-content-center ${selectedPersonnel?.id === fp.id ? 'bg-primary text-white' : 'bg-body-secondary text-body'}`}
                      style={{ width: '40px', height: '40px' }}
                    >
                      <CIcon icon={cilUser} />
                    </div>
                    <div className="text-start">
                      <div className="fw-semibold">{fp.name}</div>
                      <div
                        className={`small ${selectedPersonnel?.id === fp.id ? 'text-white opacity-75' : 'text-body-secondary'}`}
                      >
                        {fp.id}
                      </div>
                    </div>
                  </div>
                  <div className="text-end d-flex gap-2">
                    {fp.activeTasksCount > 0 && (
                      <CBadge
                        color={selectedPersonnel?.id === fp.id ? 'light' : 'info'}
                        textColor={selectedPersonnel?.id === fp.id ? 'primary' : ''}
                        shape="rounded-pill"
                        title="Active Tasks"
                      >
                        {fp.activeTasksCount} <CIcon icon={cilTask} size="sm" />
                      </CBadge>
                    )}
                    {fp.pendingReportsCount > 0 && (
                      <CBadge
                        color={selectedPersonnel?.id === fp.id ? 'light' : 'warning'}
                        textColor={selectedPersonnel?.id === fp.id ? 'warning' : ''}
                        shape="rounded-pill"
                        title="Pending Reports"
                      >
                        {fp.pendingReportsCount} <CIcon icon={cilFile} size="sm" />
                      </CBadge>
                    )}
                  </div>
                </CListGroupItem>
              ))}
            </CListGroup>
          </CCard>
        </CCol>

        {/* Right Column: Selected Details */}
        <CCol xs={12} lg={8}>
          {selectedPersonnel ? (
            <div className="d-flex flex-column gap-4">
              {/* Selected Header */}
              <CCard className="shadow-sm border-top border-4 border-top-primary">
                <CCardBody className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-1 fw-bold">{selectedPersonnel.name}</h5>
                    <div className="text-body-secondary small">ID: {selectedPersonnel.id}</div>
                  </div>
                  <CButton
                    color="primary"
                    size="sm"
                    onClick={() => navigate('/pms/daily-reports/tasks')}
                  >
                    Assign New Task
                  </CButton>
                </CCardBody>
              </CCard>

              {/* Live Tasks */}
              <div>
                <h6 className="fw-semibold mb-3 d-flex align-items-center gap-2">
                  <CIcon icon={cilTask} className="text-primary" /> Project Tasks for{' '}
                  {selectedPersonnel.name.split(' ')[0]}
                </h6>
                {selectedTasks.length > 0 ? (
                  selectedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} showAssignee={false} showActions={false} />
                  ))
                ) : (
                  <CCard className="border-dashed bg-transparent shadow-none">
                    <CCardBody className="text-center text-body-tertiary py-4">
                      No active tasks assigned to the projects this personnel is in.
                    </CCardBody>
                  </CCard>
                )}
              </div>

              {/* Submitted Reports */}
              <div>
                <h6 className="fw-semibold mb-3 d-flex align-items-center gap-2">
                  <CIcon icon={cilFile} className="text-warning" /> Reports Pending Review
                </h6>
                {selectedReports.length > 0 ? (
                  selectedReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      showPersonnel={false}
                      onClick={() => navigate(`/pms/daily-reports/review/${report.id}`)}
                    />
                  ))
                ) : (
                  <CCard className="border-dashed bg-transparent shadow-none">
                    <CCardBody className="text-center text-body-tertiary py-4">
                      No pending reports from this personnel.
                    </CCardBody>
                  </CCard>
                )}
              </div>
            </div>
          ) : (
            <CCard className="h-100 shadow-sm border-0 d-none d-lg-flex align-items-center justify-content-center">
              <CCardBody className="text-center py-5">
                <CIcon icon={cilUser} size="3xl" className="text-body-tertiary mb-3 opacity-50" />
                <h5 className="text-body-secondary">Select Field Personnel</h5>
                <p className="text-body-tertiary small">
                  Click on a personnel from the list to view their active workload and pending
                  reports.
                </p>
              </CCardBody>
            </CCard>
          )}
        </CCol>
      </CRow>
    </>
  )
}

export default FieldPersonnelOverviewPage
