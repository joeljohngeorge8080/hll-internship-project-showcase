/**
 * MyTasksPage — Field Personnel's project task view.
 *
 * Route: /pms/daily-reports/my-tasks
 * Shows all tasks for projects the current FP is a member of (by email).
 * Any team member can submit a report for any active project task.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
  CBadge,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBuilding, cilTask } from '@coreui/icons'

import TaskCard from './components/TaskCard'
import { localTasks } from '../../../services/localTasks'
import { localProjects } from '../../../services/localProjects'

// Demo: current FP email — in production this comes from auth context
const CURRENT_FP_EMAIL = 'rajesh.kumar@example.com'

const MyTasksPage = () => {
  const navigate = useNavigate()
  const [myProjects, setMyProjects] = useState([])
  const [tasksByProject, setTasksByProject] = useState({})
  const [statusFilter, setStatusFilter] = useState('active')

  const loadData = useCallback(async () => {
    // Seed both data stores
    localProjects.seedDemoData()

    // Find all projects this FP belongs to (by email)
    const projects = await localProjects.getByPersonnelEmail(CURRENT_FP_EMAIL)
    setMyProjects(projects)

    // Seed tasks using real project IDs
    localTasks.seedDemoData(projects)

    // Load tasks for each project
    const taskMap = {}
    projects.forEach((proj) => {
      const tasks = localTasks.getByProject(proj.id, {
        status: statusFilter || '',
      })
      if (tasks.length > 0) {
        taskMap[proj.id] = { project: proj, tasks }
      }
    })
    setTasksByProject(taskMap)
  }, [statusFilter])

  useEffect(() => {
    let cancelled = false
    loadData().catch(() => {
      if (!cancelled) setTasksByProject({})
    })
    return () => {
      cancelled = true
    }
  }, [loadData])

  const handleSubmitReport = (taskId) => {
    navigate(`/pms/tasks/report/${taskId}`)
  }

  const totalActive = Object.values(tasksByProject).reduce(
    (sum, { tasks }) => sum + tasks.filter((t) => t.status === 'active').length,
    0,
  )

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">My Tasks</h4>
          <p className="text-body-secondary mb-0 small">
            Tasks from {myProjects.length} project{myProjects.length !== 1 ? 's' : ''} you are
            assigned to
            {totalActive > 0 && ` · ${totalActive} active`}
          </p>
        </div>
        <CFormSelect
          size="sm"
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Tasks</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </CFormSelect>
      </div>

      {myProjects.length === 0 ? (
        <CAlert color="info">
          You are not assigned to any projects yet. Contact your Project Officer to be added to a
          project team.
        </CAlert>
      ) : Object.keys(tasksByProject).length === 0 ? (
        <CCard className="shadow-sm">
          <CCardBody className="text-center py-5">
            <div className="mb-3 text-body-secondary">
              <CIcon icon={cilTask} style={{ width: 48, height: 48 }} />
            </div>
            <h5 className="text-body-secondary">No tasks found</h5>
            <p className="text-body-tertiary">
              {statusFilter
                ? 'No tasks match this filter.'
                : 'Your project teams have no tasks yet.'}
            </p>
          </CCardBody>
        </CCard>
      ) : (
        // Group tasks by project
        <div className="d-flex flex-column gap-4">
          {Object.values(tasksByProject).map(({ project, tasks }) => (
            <div key={project.id}>
              {/* Project header */}
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-primary-subtle text-primary rounded">
                  <CIcon icon={cilBuilding} />
                </div>
                <div>
                  <div className="fw-semibold">{project.title}</div>
                  <div className="small text-body-secondary">{project.location}</div>
                </div>
                <CBadge color="primary" shape="rounded-pill" className="ms-auto">
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </CBadge>
              </div>

              {/* Tasks for this project */}
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSubmitReport={task.status === 'active' ? handleSubmitReport : undefined}
                  showActions={task.status === 'active'}
                  showAssignee={false}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default MyTasksPage
