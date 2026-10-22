import React, { useEffect, useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilTrash } from '@coreui/icons'

import { usePermission } from '../../../../hooks/usePermission'
import { MODULE } from '../../../../constants/modules'
import api from '../../../../services/api'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'

const CategoryManager = () => {
  const canEdit = usePermission(MODULE.GENERAL_EXPENSES, 'edit')

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/general-expenses/categories?include_inactive=true')
      setCategories(data)
    } catch {
      setCategories(await localGeneralExpenses.categories.list(true))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormDesc('')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (cat) => {
    setEditing(cat)
    setFormName(cat.name)
    setFormDesc(cat.description || '')
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.patch(`/general-expenses/categories/${editing.id}`, {
          name: formName.trim(),
          description: formDesc.trim() || null,
        })
      } else {
        await api.post('/general-expenses/categories', {
          name: formName.trim(),
          description: formDesc.trim() || null,
        })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Save failed'
      // Fallback local
      try {
        if (editing) {
          await localGeneralExpenses.categories.update(editing.id, {
            name: formName.trim(),
            description: formDesc.trim() || null,
          })
        } else {
          await localGeneralExpenses.categories.create(formName.trim(), formDesc.trim() || null)
        }
        setModalOpen(false)
        setCategories(await localGeneralExpenses.categories.list(true))
      } catch (localErr) {
        setError(localErr.message || msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (cat) => {
    try {
      await api.patch(`/general-expenses/categories/${cat.id}`, { is_active: !cat.is_active })
    } catch {
      await localGeneralExpenses.categories.update(cat.id, { is_active: !cat.is_active })
    }
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/general-expenses/categories/${deleteTarget.id}`)
    } catch (err) {
      if (err.response?.status !== 404) {
        try {
          await localGeneralExpenses.categories.delete(deleteTarget.id)
        } catch (localErr) {
          alert(localErr.message)
          setDeleteTarget(null)
          return
        }
      }
    }
    setDeleteTarget(null)
    load()
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Expense Categories</strong>
          {canEdit && (
            <CButton color="primary" size="sm" onClick={openCreate}>
              <CIcon icon={cilPlus} className="me-1" /> Add Category
            </CButton>
          )}
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-4">
              <CSpinner />
            </div>
          ) : (
            <CTable small hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>Description</CTableHeaderCell>
                  <CTableHeaderCell>Status</CTableHeaderCell>
                  {canEdit && <CTableHeaderCell>Actions</CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {categories.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={4} className="text-center text-body-secondary py-4">
                      No categories yet. Add one to get started.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {categories.map((cat) => (
                  <CTableRow key={cat.id}>
                    <CTableDataCell className="fw-semibold">{cat.name}</CTableDataCell>
                    <CTableDataCell className="text-body-secondary">
                      {cat.description || '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={cat.is_active ? 'success' : 'secondary'}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </CBadge>
                    </CTableDataCell>
                    {canEdit && (
                      <CTableDataCell>
                        <CButton
                          color="secondary"
                          variant="ghost"
                          size="sm"
                          className="me-1"
                          onClick={() => openEdit(cat)}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          color={cat.is_active ? 'warning' : 'success'}
                          variant="ghost"
                          size="sm"
                          className="me-1"
                          onClick={() => toggleActive(cat)}
                          title={cat.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {cat.is_active ? '✕' : '✓'}
                        </CButton>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* Create / Edit Modal */}
      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>{editing ? 'Edit Category' : 'New Category'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <div className="mb-3">
            <CFormLabel className="fw-semibold">
              Name <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. House Rent"
            />
          </div>
          <div>
            <CFormLabel>Description</CFormLabel>
            <CFormInput
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
            Cancel
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={saving}>
            {saving && <CSpinner size="sm" className="me-1" />}
            Save
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Delete Confirm */}
      <CModal visible={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <CModalHeader>
          <CModalTitle>Delete Category</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be
          undone. If there are expense records using this category, deletion will be blocked.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </CButton>
          <CButton color="danger" onClick={handleDelete}>
            Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default CategoryManager
