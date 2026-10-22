/**
 * TaskManagementPage — Project Officer task assignment page.
 *
 * Route: /pms/daily-reports/tasks
 * Create/manage task assignments for field personnel.
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilFilterX, cilNotes } from '@coreui/icons'

import TaskCard from './components/TaskCard'
import TaskAssignModal from './components/TaskAssignModal'
import { localTasks } from '../../../services/localTasks'

const TaskManagementPage = () => {
  const [tasks, setTasks] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ search: '', status: '', assignee: '' })
  const [modalVisible, setModalVisible] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const loadTasks = useCallback(() => {
    localTasks.seedDemoData()
    const result = localTasks.list({
      search: filters.search,
      status: filters.status,
      assignee: filters.assignee,
    })
    setTasks(result.items)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreateTask = (formData) => {
    setModalLoading(true)
    try {
      localTasks.create(formData)
      setToast({ color: 'success', message: 'Task assigned successfully' })
      setModalVisible(false)
      loadTasks()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setModalLoading(false)
  }

  const handleComplete = (id) => {
    try {
      localTasks.complete(id)
      setToast({ color: 'success', message: 'Task marked as completed' })
      loadTasks()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
  }

  const handleCancel = (id) => {
    try {
      localTasks.cancel(id)
      setToast({ color: 'warning', message: 'Task cancelled' })
      loadTasks()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', status: '', assignee: '' })
  }

  // Stats
  const activeCount = tasks.filter((t) => t.status === 'active').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1 fw-semibold">Task Assignments</h4>
          <p className="text-body-secondary mb-0 small">
            {total} total tasks • {activeCount} active • {completedCount} completed
          </p>
        </div>
        <CButton color="primary" onClick={() => setModalVisible(true)}>
          <CIcon icon={cilPlus} className="me-1" />
          Assign Task
        </CButton>
      </div>

      {/* Filters */}
      <CCard className="mb-3 shadow-sm">
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-end">
            <CCol xs={12} md={4}>
              <CInputGroup size="sm">
                <CInputGroupText>
                  <CIcon icon={cilSearch} size="sm" />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search tasks..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={3}>
              <CFormSelect
                size="sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={3}>
              <CFormSelect
                size="sm"
                value={filters.assignee}
                onChange={(e) => handleFilterChange('assignee', e.target.value)}
              >
                <option value="">All Personnel</option>
                {[...new Set(tasks.map((t) => t.assigned_to))].map((id) => {
                  const task = tasks.find((t) => t.assigned_to === id)
                  return (
                    <option key={id} value={id}>
                      {task?.assigned_to_name || id}
                    </option>
                  )
                })}
              </CFormSelect>
            </CCol>
            <CCol xs={12} md={2}>
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-100"
              >
                <CIcon icon={cilFilterX} size="sm" className="me-1" />
                Clear
              </CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Task list */}
      {tasks.length === 0 ? (
        <CCard className="shadow-sm">
          <CCardBody className="text-center py-5">
            <div className="mb-3 text-body-secondary">
              <CIcon icon={cilNotes} style={{ width: 48, height: 48 }} />
            </div>
            <h5 className="text-body-secondary">No tasks found</h5>
            <p className="text-body-tertiary mb-3">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Assign tasks to field personnel to get started'}
            </p>
            {!filters.search && !filters.status && (
              <CButton color="primary" onClick={() => setModalVisible(true)}>
                <CIcon icon={cilPlus} className="me-1" />
                Assign Task
              </CButton>
            )}
          </CCardBody>
        </CCard>
      ) : (
        <div>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onCancel={handleCancel}
              showActions
              showAssignee
            />
          ))}
        </div>
      )}

      {/* Create task modal */}
      <TaskAssignModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleCreateTask}
        loading={modalLoading}
      />

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

export default TaskManagementPage
