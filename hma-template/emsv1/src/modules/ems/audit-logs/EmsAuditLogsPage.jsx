import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CPagination,
  CPaginationItem,
  CSpinner,
  CRow,
  CCol,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSearch,
  cilFilter,
  cilCloudDownload,
  cilListRich,
  cilReload,
  cilClock,
  cilTrash,
} from '@coreui/icons'
import supabase from '../../../services/supabase'
import { supabaseAudit } from '../../../services/supabaseAudit'
import useRole from '../../../hooks/useRole'
import { ROLE, roleDisplayName } from '../../../constants/roles'

// ── Action badge colour map ──────────────────────────────────────────────────

const getActionColor = (action = '') => {
  if (
    action.includes('CREATED') ||
    action.includes('IMPORTED') ||
    action.includes('APPLIED') ||
    action === 'USER_LOGIN'
  )
    return 'success'
  if (action.includes('UPDATED') || action.includes('INCREMENT') || action.includes('CORRECTED'))
    return 'primary'
  if (
    action.includes('DELETED') ||
    action.includes('REVERTED') ||
    action === 'USER_LOGOUT' ||
    action === 'ACCESS_DENIED'
  )
    return 'danger'
  if (action.includes('GENERATED') || action.includes('PLAN')) return 'info'
  if (action.includes('STATUS') || action.includes('SALARY')) return 'warning'
  return 'secondary'
}

const formatAction = (action = '') =>
  action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatTimestamp = (ts) => {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return ts
  }
}

// ── Module badge colours ─────────────────────────────────────────────────────

const MODULE_COLORS = {
  'Staff & Payroll': 'info',
  Projects: 'primary',
  Attendance: 'warning',
  'General Expenses': 'success',
  'Expense Pools': 'dark',
  Auth: 'secondary',
}

const PAGE_SIZE = 50
// Working set fetched per query — audit_logs is the single source now, so
// this replaces the old local(unbounded)+db(500) split with one cap that
// covers realistic filtering/pagination without fetching the whole table.
const FETCH_LIMIT = 2000

const matchesFilters = (r, { moduleFilter, actionFilter, dateFrom, dateTo, search }) => {
  if (moduleFilter && r.module !== moduleFilter) return false
  if (actionFilter && r.action !== actionFilter) return false
  if (dateFrom && r.timestamp < dateFrom + 'T00:00:00Z') return false
  if (dateTo) {
    const to = dateTo.length === 10 ? dateTo + 'T23:59:59Z' : dateTo
    if (r.timestamp > to) return false
  }
  if (search) {
    const q = search.toLowerCase()
    if (
      !(
        r.user_name?.toLowerCase().includes(q) ||
        r.module?.toLowerCase().includes(q) ||
        r.action?.toLowerCase().includes(q) ||
        r.record_label?.toLowerCase().includes(q) ||
        r.details?.toLowerCase().includes(q)
      )
    )
      return false
  }
  return true
}

// ── Component ────────────────────────────────────────────────────────────────

const EmsAuditLogsPage = () => {
  const role = useRole()
  const isAdmin = role === ROLE.ADMIN

  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [dbError, setDbError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [allModules, setAllModules] = useState([])
  const [allActions, setAllActions] = useState([])

  // Total count stat
  const [totalCount, setTotalCount] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await supabaseAudit.list({ limit: FETCH_LIMIT })
      setDbError('')

      const filtered = entries.filter((r) =>
        matchesFilters(r, { moduleFilter, actionFilter, dateFrom, dateTo, search }),
      )

      const total_ = filtered.length
      const total_pages_ = Math.max(1, Math.ceil(total_ / PAGE_SIZE))
      const start = (page - 1) * PAGE_SIZE

      setLogs(filtered.slice(start, start + PAGE_SIZE))
      setTotal(total_)
      setTotalPages(total_pages_)
      setLastRefresh(Date.now())

      supabaseAudit
        .count()
        .then(setTotalCount)
        .catch(() => setTotalCount(entries.length))
    } catch (err) {
      setDbError(err.message)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [search, moduleFilter, actionFilter, dateFrom, dateTo, page])

  // Initial load of filter options
  useEffect(() => {
    supabaseAudit
      .getModules()
      .then(setAllModules)
      .catch(() => {})
    supabaseAudit
      .getActions()
      .then(setAllActions)
      .catch(() => {})
  }, [lastRefresh])

  const handleDelete = async (log) => {
    if (!isAdmin) return
    if (
      !window.confirm(
        `Permanently delete this audit entry (${log.action} — ${log.record_label})? This cannot be undone.`,
      )
    )
      return
    setDeletingId(log.id)
    try {
      await supabaseAudit.remove(log.id)
      await fetchLogs()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Fetch when deps change
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Refreshes on any change to audit_logs, so new entries from other
  // users/tabs/devices appear without a manual reload or a polling delay.
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, fetchLogs)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchLogs])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  const handleReset = () => {
    setSearch('')
    setModuleFilter('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleExportCsv = async () => {
    let entries = []
    try {
      entries = await supabaseAudit.list({ limit: FETCH_LIMIT })
    } catch (err) {
      window.alert(`Could not export: ${err.message}`)
      return
    }
    const headers = ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Record', 'Details']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = entries.map((r) =>
      [r.timestamp, r.user_name, r.role, r.module, r.action, r.record_label, r.details]
        .map(escape)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hma_audit_log_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="fw-semibold mb-1">Audit Logs</h4>
          <p className="text-body-secondary small mb-0">
            All system mutations — append-only; only an Admin can delete an entry.
            <span className="ms-2 badge bg-secondary">
              {totalCount.toLocaleString()} entries total
            </span>
          </p>
          {dbError && (
            <p className="text-warning small mb-0 mt-1">Audit log unavailable: {dbError}</p>
          )}
        </div>
        <div className="d-flex gap-2">
          <CTooltip content="Refresh now">
            <CButton
              color="light"
              size="sm"
              variant="outline"
              onClick={fetchLogs}
              disabled={loading}
            >
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
            </CButton>
          </CTooltip>
          <CButton color="success" size="sm" variant="outline" onClick={handleExportCsv}>
            <CIcon icon={cilCloudDownload} className="me-1" />
            Export CSV
          </CButton>
        </div>
      </div>

      {/* Filter bar */}
      <CCard className="mb-3">
        <CCardHeader className="py-2 d-flex align-items-center gap-2">
          <CIcon icon={cilFilter} className="text-body-secondary" />
          <span className="fw-medium small">Filters</span>
        </CCardHeader>
        <CCardBody className="py-3">
          <form onSubmit={handleSearch}>
            <CRow className="g-2">
              <CCol sm={12} md={4} lg={3}>
                <CInputGroup size="sm">
                  <CInputGroupText>
                    <CIcon icon={cilSearch} />
                  </CInputGroupText>
                  <CFormInput
                    placeholder="Search user, module, record…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </CInputGroup>
              </CCol>
              <CCol sm={6} md={3} lg={2}>
                <CFormSelect
                  size="sm"
                  value={moduleFilter}
                  onChange={(e) => {
                    setModuleFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All Modules</option>
                  {allModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol sm={6} md={3} lg={2}>
                <CFormSelect
                  size="sm"
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All Actions</option>
                  {allActions.map((a) => (
                    <option key={a} value={a}>
                      {formatAction(a)}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol sm={6} md={2} lg={2}>
                <CFormInput
                  type="date"
                  size="sm"
                  placeholder="From date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setPage(1)
                  }}
                  title="From date"
                />
              </CCol>
              <CCol sm={6} md={2} lg={2}>
                <CFormInput
                  type="date"
                  size="sm"
                  placeholder="To date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setPage(1)
                  }}
                  title="To date"
                />
              </CCol>
              <CCol sm={12} md={12} lg={1} className="d-flex gap-2">
                <CButton type="submit" color="primary" size="sm" className="flex-grow-1">
                  Apply
                </CButton>
                <CButton
                  type="button"
                  color="light"
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  className="flex-grow-1"
                >
                  Reset
                </CButton>
              </CCol>
            </CRow>
          </form>
        </CCardBody>
      </CCard>

      {/* Table */}
      <CCard>
        <CCardBody className="p-0">
          {loading && (
            <div className="text-center py-4">
              <CSpinner size="sm" className="me-2" />
              <span className="text-body-secondary small">Loading…</span>
            </div>
          )}
          {!loading && (
            <CTable hover responsive align="middle" className="mb-0 small">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell style={{ width: 165 }}>
                    <CIcon icon={cilClock} className="me-1 text-body-secondary" />
                    Timestamp
                  </CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 150 }}>User</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Module</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 180 }}>Action</CTableHeaderCell>
                  <CTableHeaderCell>Record</CTableHeaderCell>
                  <CTableHeaderCell>Details</CTableHeaderCell>
                  {isAdmin && <CTableHeaderCell style={{ width: 60 }}></CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {logs.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={isAdmin ? 7 : 6}>
                      <div className="hma-empty-state py-5">
                        <CIcon icon={cilListRich} className="hma-empty-state__icon" />
                        <p className="hma-empty-state__title">No audit log entries</p>
                        <p className="hma-empty-state__desc">
                          {search || moduleFilter || actionFilter || dateFrom || dateTo
                            ? 'No entries match your filters. Try broadening the search.'
                            : 'Perform any create, edit, or delete action and it will appear here immediately.'}
                        </p>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  logs.map((log) => (
                    <CTableRow key={log.id}>
                      {/* Timestamp */}
                      <CTableDataCell
                        className="text-nowrap text-body-secondary"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {formatTimestamp(log.timestamp)}
                      </CTableDataCell>

                      {/* User */}
                      <CTableDataCell>
                        <div className="fw-medium">{log.user_name || '—'}</div>
                        <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                          {roleDisplayName(log.role)}
                        </div>
                      </CTableDataCell>

                      {/* Module */}
                      <CTableDataCell>
                        <CBadge
                          color={MODULE_COLORS[log.module] || 'secondary'}
                          shape="rounded-pill"
                          style={{ fontSize: '0.7rem' }}
                        >
                          {log.module}
                        </CBadge>
                      </CTableDataCell>

                      {/* Action */}
                      <CTableDataCell>
                        <CBadge
                          color={getActionColor(log.action)}
                          shape="rounded-pill"
                          style={{ fontSize: '0.7rem' }}
                        >
                          {formatAction(log.action)}
                        </CBadge>
                      </CTableDataCell>

                      {/* Record */}
                      <CTableDataCell>
                        <span className="fw-medium">{log.record_label || '—'}</span>
                        {log.record_id && log.record_id !== log.record_label && (
                          <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                            ID: {log.record_id}
                          </div>
                        )}
                      </CTableDataCell>

                      {/* Details */}
                      <CTableDataCell className="text-body-secondary">
                        {log.details || '—'}
                      </CTableDataCell>

                      {/* Delete — admin only */}
                      {isAdmin && (
                        <CTableDataCell>
                          <CTooltip content="Delete this entry (Admin only)">
                            <CButton
                              color="danger"
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === log.id}
                              onClick={() => handleDelete(log)}
                            >
                              {deletingId === log.id ? (
                                <CSpinner size="sm" />
                              ) : (
                                <CIcon icon={cilTrash} />
                              )}
                            </CButton>
                          </CTooltip>
                        </CTableDataCell>
                      )}
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* Pagination + count */}
      {total > 0 && (
        <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
          <span className="small text-body-secondary">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
            {Math.min(page * PAGE_SIZE, total)} of <strong>{total.toLocaleString()}</strong> entries
            {(moduleFilter || actionFilter || search) && ' (filtered)'}
          </span>
          {totalPages > 1 && (
            <CPagination aria-label="Audit log pages" size="sm">
              <CPaginationItem
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </CPaginationItem>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p =
                  totalPages <= 7
                    ? i + 1
                    : page <= 4
                      ? i + 1
                      : page >= totalPages - 3
                        ? totalPages - 6 + i
                        : page - 3 + i
                return (
                  <CPaginationItem key={p} active={p === page} onClick={() => setPage(p)}>
                    {p}
                  </CPaginationItem>
                )
              })}
              <CPaginationItem
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </CPaginationItem>
            </CPagination>
          )}
        </div>
      )}

      {/* Last refresh note */}
      <p className="text-body-secondary mt-2" style={{ fontSize: '0.7rem' }}>
        Updates live as new entries are recorded. Last refreshed:{' '}
        {new Date(lastRefresh).toLocaleTimeString('en-IN')}. Entries are append-only — only an Admin
        can delete one, and never edit one.
      </p>
    </>
  )
}

export default EmsAuditLogsPage
