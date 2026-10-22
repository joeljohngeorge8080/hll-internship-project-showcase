import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CButton,
  CFormInput,
  CFormSelect,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilPencil,
  cilTrash,
  cilSearch,
  cilBuilding,
  cilPeople,
  cilMoney,
  cilChevronBottom,
  cilChevronTop,
  cilX,
} from '@coreui/icons'
import { localDonors } from '../../../services/localDonors'
import { localProjects } from '../../../services/localProjects'
import { localDonorDocuments } from '../../../services/localDonorDocuments'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import DocumentLibraryPanel from '../../ems/shared/DocumentLibraryPanel'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0)

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 30 }, (_, i) => THIS_YEAR - i)

const EMPTY = {
  funding_agency: '',
  location: '',
  project_id: '',
  project_name: '',
  num_beneficiaries: '',
  project_value: '',
  year: THIS_YEAR,
  start_date: '',
  end_date: '',
  notes: '',
}

// ── Donor Form Modal ──────────────────────────────────────────────────────────

const DonorModal = ({ visible, onClose, onSave, initial, projects }) => {
  const [form, setForm] = useState(initial || EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(
      initial
        ? {
            ...initial,
            project_value: String(initial.project_value || ''),
            num_beneficiaries: String(initial.num_beneficiaries || ''),
          }
        : EMPTY,
    )
    setErrors({})
  }, [initial, visible])

  const set = (f, v) => {
    setForm((p) => {
      const next = { ...p, [f]: v }
      // Auto-fill project name when project is selected
      if (f === 'project_id') {
        const proj = projects.find((pr) => pr.id === v)
        next.project_name = proj?.name || ''
      }
      return next
    })
    setErrors((p) => ({ ...p, [f]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.funding_agency.trim()) e.funding_agency = 'Funding agency name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({
      ...form,
      project_value: parseFloat(form.project_value) || 0,
      num_beneficiaries: parseInt(form.num_beneficiaries) || 0,
      year: form.year ? parseInt(form.year) : null,
    })
    onClose()
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" size="lg">
      <CModalHeader closeButton>
        <CModalTitle>
          <CIcon icon={initial?.id ? cilPencil : cilPlus} className="me-2 text-primary" />
          {initial?.id ? `Edit — ${initial.funding_agency}` : 'Add Donor Record'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className="g-3">
          {/* Agency name */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">
              Funding Agency Name <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              placeholder="e.g., HDFC Bank CSR, NABARD, Kerala Government"
              value={form.funding_agency}
              onChange={(e) => set('funding_agency', e.target.value)}
              invalid={!!errors.funding_agency}
            />
            {errors.funding_agency && (
              <div className="text-danger small mt-1">{errors.funding_agency}</div>
            )}
          </CCol>

          {/* Year */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Year</CFormLabel>
            <CFormSelect value={form.year || ''} onChange={(e) => set('year', e.target.value)}>
              <option value="">— Select year —</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          {/* Location */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Location</CFormLabel>
            <CFormInput
              placeholder="e.g., Mumbai, Maharashtra"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
            />
          </CCol>

          {/* Start date */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Start Date</CFormLabel>
            <CFormInput
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
            />
          </CCol>

          {/* End date */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">End Date</CFormLabel>
            <CFormInput
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
            />
          </CCol>

          {/* Project */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Project Contributed To</CFormLabel>
            <CFormSelect
              value={form.project_id}
              onChange={(e) => set('project_id', e.target.value)}
            >
              <option value="">— Select project (optional) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </CFormSelect>
            {!form.project_id && (
              <CFormInput
                className="mt-1"
                size="sm"
                placeholder="Or type project name manually"
                value={form.project_name}
                onChange={(e) => set('project_name', e.target.value)}
              />
            )}
          </CCol>

          {/* Fund amount */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Fund Amount (₹)</CFormLabel>
            <CInputGroup>
              <CInputGroupText>₹</CInputGroupText>
              <CFormInput
                type="number"
                min="0"
                placeholder="0"
                value={form.project_value}
                onChange={(e) => set('project_value', e.target.value)}
              />
            </CInputGroup>
          </CCol>

          {/* Beneficiaries */}
          <CCol xs={12} md={6}>
            <CFormLabel className="small fw-semibold">Number of Beneficiaries</CFormLabel>
            <CFormInput
              type="number"
              min="0"
              placeholder="0"
              value={form.num_beneficiaries}
              onChange={(e) => set('num_beneficiaries', e.target.value)}
            />
          </CCol>

          {/* Notes */}
          <CCol xs={12}>
            <CFormLabel className="small fw-semibold">Notes</CFormLabel>
            <CFormInput
              placeholder="Any additional details about this contribution"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleSave}>
          <CIcon icon={initial?.id ? cilPencil : cilPlus} className="me-1" />
          {initial?.id ? 'Save Changes' : 'Add Donor Record'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

// ── All Records flat table ────────────────────────────────────────────────────

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

const DateRange = ({ start, end }) => {
  if (!start && !end) return <span className="text-body-secondary">—</span>
  if (start && end)
    return (
      <span>
        {fmtDate(start)} – {fmtDate(end)}
      </span>
    )
  if (start) return <span>{fmtDate(start)} onwards</span>
  return <span>Until {fmtDate(end)}</span>
}

const RecordsTable = ({ records, sl_offset = 0, onEdit, onRemove, compact = false }) => (
  <div className="table-responsive">
    <CTable
      hover
      align="middle"
      className="mb-0"
      style={{ fontSize: compact ? '0.8rem' : '0.875rem' }}
    >
      <CTableHead className="bg-body-tertiary">
        <CTableRow>
          <CTableHeaderCell className="border-0 py-2 ps-3">SL</CTableHeaderCell>
          {!compact && (
            <CTableHeaderCell className="border-0 py-2">Funding Agency</CTableHeaderCell>
          )}
          <CTableHeaderCell className="border-0 py-2">Year</CTableHeaderCell>
          <CTableHeaderCell className="border-0 py-2">Period</CTableHeaderCell>
          <CTableHeaderCell className="border-0 py-2">Location</CTableHeaderCell>
          <CTableHeaderCell className="border-0 py-2">Project</CTableHeaderCell>
          <CTableHeaderCell className="border-0 py-2">Fund Amount</CTableHeaderCell>
          <CTableHeaderCell className="border-0 py-2">Beneficiaries</CTableHeaderCell>
          {!compact && <CTableHeaderCell className="border-0 py-2">Notes</CTableHeaderCell>}
          <CTableHeaderCell className="border-0 py-2" />
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {records.map((r, i) => (
          <CTableRow key={r.id}>
            <CTableDataCell className="ps-3 text-body-secondary small fw-semibold">
              {sl_offset + i + 1}
            </CTableDataCell>
            {!compact && (
              <CTableDataCell>
                <div className="fw-semibold">{r.funding_agency}</div>
              </CTableDataCell>
            )}
            <CTableDataCell>
              {r.year ? (
                <CBadge color="secondary" shape="rounded-pill">
                  {r.year}
                </CBadge>
              ) : (
                <span className="text-body-secondary small">—</span>
              )}
            </CTableDataCell>
            <CTableDataCell className="small text-body-secondary text-nowrap">
              <DateRange start={r.start_date} end={r.end_date} />
            </CTableDataCell>
            <CTableDataCell className="small">{r.location || '—'}</CTableDataCell>
            <CTableDataCell className="small text-truncate" style={{ maxWidth: 180 }}>
              {r.project_name || <span className="text-body-secondary">—</span>}
            </CTableDataCell>
            <CTableDataCell className="fw-bold" style={{ color: '#4361ee' }}>
              {r.project_value ? (
                fmt(r.project_value)
              ) : (
                <span className="text-body-secondary small">—</span>
              )}
            </CTableDataCell>
            <CTableDataCell>
              {r.num_beneficiaries > 0 ? (
                <span className="fw-semibold">{fmtNum(r.num_beneficiaries)}</span>
              ) : (
                <span className="text-body-secondary small">—</span>
              )}
            </CTableDataCell>
            {!compact && (
              <CTableDataCell
                className="small text-body-secondary text-truncate"
                style={{ maxWidth: 140 }}
              >
                {r.notes || '—'}
              </CTableDataCell>
            )}
            <CTableDataCell className="text-end pe-3">
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                className="me-1"
                onClick={() => onEdit(r)}
              >
                <CIcon icon={cilPencil} />
              </CButton>
              <CButton color="danger" variant="ghost" size="sm" onClick={() => onRemove(r.id)}>
                <CIcon icon={cilTrash} />
              </CButton>
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  </div>
)

// ── Grouped by Agency view ────────────────────────────────────────────────────

const AgencyGroupView = ({ groups, onEdit, onRemove }) => {
  const [openGroups, setOpenGroups] = useState({})
  const toggle = (name) => setOpenGroups((p) => ({ ...p, [name]: !p[name] }))

  let slCounter = 0

  if (groups.length === 0) {
    return (
      <div className="text-center text-body-secondary py-5">
        <CIcon
          icon={cilBuilding}
          style={{ width: 48, height: 48, opacity: 0.3 }}
          className="d-block mx-auto mb-2"
        />
        <div className="small">No donor records yet. Click "Add Donor Record" to get started.</div>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3">
      {groups.map((group) => {
        const startSl = slCounter
        slCounter += group.records.length
        return (
          <CCard key={group.name} className="border-0 shadow-sm" style={{ borderRadius: 12 }}>
            {/* Agency header — clickable */}
            <div
              className="d-flex align-items-center justify-content-between px-4 py-3 rounded-top"
              style={{
                cursor: 'pointer',
                background: openGroups[group.name] ? 'rgba(67,97,238,0.06)' : undefined,
              }}
              onClick={() => toggle(group.name)}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                  style={{ width: 40, height: 40, background: '#4361ee', fontSize: '1.1rem' }}
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="fw-bold fs-6">{group.name}</div>
                  <div className="text-body-secondary small">
                    {group.records.length} contribution{group.records.length !== 1 ? 's' : ''}
                    {' · '}
                    {group.records
                      .map((r) => r.year)
                      .sort()
                      .join(', ')}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-3">
                <div className="text-end d-none d-md-block">
                  <div className="fw-bold" style={{ color: '#4361ee' }}>
                    {fmt(group.totalValue)}
                  </div>
                  <div className="text-body-secondary small">total contributed</div>
                </div>
                {group.totalBeneficiaries > 0 && (
                  <div className="text-end d-none d-lg-block">
                    <div className="fw-semibold">{fmtNum(group.totalBeneficiaries)}</div>
                    <div className="text-body-secondary small">beneficiaries</div>
                  </div>
                )}
                <CIcon
                  icon={openGroups[group.name] ? cilChevronTop : cilChevronBottom}
                  style={{ width: 16, height: 16, color: 'var(--cui-body-secondary-color)' }}
                />
              </div>
            </div>

            {/* Agency records */}
            {openGroups[group.name] && (
              <div className="border-top">
                <RecordsTable
                  records={group.records}
                  sl_offset={startSl}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  compact
                />
              </div>
            )}
          </CCard>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DonorPage = () => {
  const canEdit = usePermission(MODULE.PMS_AGENCIES, 'edit')
  const currentUser = useSelector((s) => s.user)
  const currentUserName = currentUser?.full_name || currentUser?.employee_id || 'Unknown'

  const [activeTab, setActiveTab] = useState('by-agency')
  const [records, setRecords] = useState([])
  const [groups, setGroups] = useState([])
  const [projects, setProjects] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    uniqueAgencies: 0,
    totalFunds: 0,
    totalBeneficiaries: 0,
  })

  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [years, setYears] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const reload = useCallback(async () => {
    const filters = { search, year: filterYear }
    setRecords(await localDonors.list(filters))
    setGroups(await localDonors.groupByAgency())
    setSummary(await localDonors.getSummary())
    setYears(await localDonors.getYears())
    localProjects.seedDemoData()
    const { items } = await localProjects.list({ pageSize: 999 })
    setProjects(items)
  }, [search, filterYear])

  useEffect(() => {
    reload()
  }, [reload])

  const handleSave = async (data) => {
    if (editTarget?.id) await localDonors.update(editTarget.id, data)
    else await localDonors.create(data)
    reload()
  }

  const handleRemove = async (id) => {
    await localDonors.remove(id)
    reload()
  }

  const openAdd = () => {
    setEditTarget(null)
    setModalOpen(true)
  }
  const openEdit = (r) => {
    setEditTarget(r)
    setModalOpen(true)
  }

  // For grouped view, filter groups by search/year
  const filteredGroups =
    search || filterYear
      ? groups
          .map((g) => ({
            ...g,
            records: g.records.filter((r) => {
              const q = search.toLowerCase()
              const matchSearch =
                !search ||
                r.funding_agency?.toLowerCase().includes(q) ||
                r.project_name?.toLowerCase().includes(q) ||
                r.location?.toLowerCase().includes(q)
              const matchYear = !filterYear || String(r.year) === String(filterYear)
              return matchSearch && matchYear
            }),
          }))
          .filter((g) => g.records.length > 0)
      : groups

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1">Donor / Funding Agency Records</h4>
          <p className="text-body-secondary small mb-0">
            Track all funding contributions — agencies may contribute multiple times across
            different years.
          </p>
        </div>
        <CButton color="primary" onClick={openAdd}>
          <CIcon icon={cilPlus} className="me-1" />
          Add Donor Record
        </CButton>
      </div>

      {/* Summary cards */}
      <CRow className="g-3 mb-4">
        {[
          { label: 'Total Records', value: summary.total, color: '#4361ee' },
          { label: 'Unique Agencies', value: summary.uniqueAgencies, color: '#06d6a0' },
          {
            label: 'Total Funds Received',
            value: summary.totalFunds ? fmt(summary.totalFunds) : '—',
            color: '#9b5de5',
          },
          {
            label: 'Total Beneficiaries',
            value: summary.totalBeneficiaries ? fmtNum(summary.totalBeneficiaries) : '—',
            color: '#f0ad4e',
          },
        ].map((s) => (
          <CCol key={s.label} xs={6} md={3}>
            <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
              <CCardBody className="py-3 px-3">
                <div className="fw-bold fs-5 lh-1 mb-1" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="small text-body-secondary">{s.label}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Filters */}
      <CRow className="g-2 mb-3">
        <CCol xs={12} md={6}>
          <CInputGroup size="sm">
            <CInputGroupText>
              <CIcon icon={cilSearch} size="sm" />
            </CInputGroupText>
            <CFormInput
              placeholder="Search by agency, project, or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <CButton color="secondary" variant="ghost" size="sm" onClick={() => setSearch('')}>
                <CIcon icon={cilX} size="sm" />
              </CButton>
            )}
          </CInputGroup>
        </CCol>
        <CCol xs={12} md={3}>
          <CFormSelect size="sm" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        {(search || filterYear) && (
          <CCol xs="auto">
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              onClick={() => {
                setSearch('')
                setFilterYear('')
              }}
            >
              Clear
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* Tabs */}
      <CNav variant="tabs" className="mb-0">
        <CNavItem>
          <CNavLink
            active={activeTab === 'by-agency'}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('by-agency')}
          >
            <CIcon icon={cilBuilding} className="me-1" size="sm" />
            By Agency
            <CBadge color="primary" shape="rounded-pill" className="ms-2">
              {filteredGroups.length}
            </CBadge>
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 'all'}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('all')}
          >
            All Records
            <CBadge color="secondary" shape="rounded-pill" className="ms-2">
              {records.length}
            </CBadge>
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent className="border border-top-0 rounded-bottom bg-body mb-4">
        {/* By Agency tab */}
        <CTabPane visible={activeTab === 'by-agency'} className="p-3">
          <AgencyGroupView groups={filteredGroups} onEdit={openEdit} onRemove={handleRemove} />
        </CTabPane>

        {/* All Records tab */}
        <CTabPane visible={activeTab === 'all'} className="p-0">
          {records.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              <CIcon
                icon={cilMoney}
                style={{ width: 48, height: 48, opacity: 0.3 }}
                className="d-block mx-auto mb-2"
              />
              <div className="small">
                {search || filterYear ? 'No records match your filters.' : 'No donor records yet.'}
              </div>
            </div>
          ) : (
            <RecordsTable records={records} onEdit={openEdit} onRemove={handleRemove} />
          )}
        </CTabPane>
      </CTabContent>

      <DocumentLibraryPanel
        documentsService={localDonorDocuments}
        title="Files"
        canEdit={canEdit}
        currentUser={currentUserName}
      />

      <DonorModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editTarget}
        projects={projects}
      />
    </>
  )
}

export default DonorPage
