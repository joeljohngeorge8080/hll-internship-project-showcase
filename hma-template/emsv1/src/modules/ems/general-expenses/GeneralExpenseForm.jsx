import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilSave } from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import api from '../../../services/api'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'

const HR_CATEGORY_NAMES = new Set(['Outsourced Services', 'HR Operations'])

const thisYear = new Date().getFullYear()
const thisMonth = new Date().getMonth() + 1

const MONTHS = [
  { v: 1, l: 'January' },
  { v: 2, l: 'February' },
  { v: 3, l: 'March' },
  { v: 4, l: 'April' },
  { v: 5, l: 'May' },
  { v: 6, l: 'June' },
  { v: 7, l: 'July' },
  { v: 8, l: 'August' },
  { v: 9, l: 'September' },
  { v: 10, l: 'October' },
  { v: 11, l: 'November' },
  { v: 12, l: 'December' },
]

const YEARS = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1]
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Annually', 'One-time']
const STATUSES = ['Pending', 'Paid', 'Overdue', 'Cancelled']

const EMPTY = {
  category_id: '',
  expense_name: '',
  month: thisMonth,
  year: thisYear,
  frequency: 'Monthly',
  planned_amount: '',
  actual_amount: '',
  status: 'Pending',
  remarks: '',
}

const GeneralExpenseForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const canEdit = usePermission(MODULE.GENERAL_EXPENSES, 'edit')

  const [form, setForm] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadCats = async () => {
      try {
        const { data } = await api.get('/general-expenses/categories')
        setCategories(data)
      } catch {
        setCategories(await localGeneralExpenses.categories.list())
      }
    }
    loadCats()
  }, [])

  useEffect(() => {
    if (!isEdit) return
    const loadExpense = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/general-expenses/${id}`)
        setForm({
          category_id: data.category_id,
          expense_name: data.expense_name,
          month: data.month,
          year: data.year,
          frequency: data.frequency,
          planned_amount: data.planned_amount,
          actual_amount: data.actual_amount,
          status: data.status,
          remarks: data.remarks || '',
        })
      } catch {
        try {
          const exp = await localGeneralExpenses.expenses.get(id)
          setForm({
            category_id: exp.category_id,
            expense_name: exp.expense_name,
            month: exp.month,
            year: exp.year,
            frequency: exp.frequency,
            planned_amount: exp.planned_amount,
            actual_amount: exp.actual_amount,
            status: exp.status,
            remarks: exp.remarks || '',
          })
        } catch {
          setError('Expense not found')
        }
      } finally {
        setLoading(false)
      }
    }
    loadExpense()
  }, [id, isEdit])

  if (!canEdit) {
    return <CAlert color="warning">You do not have permission to manage expense records.</CAlert>
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const variance =
    form.actual_amount !== '' && form.planned_amount !== ''
      ? parseFloat(
          (parseFloat(form.actual_amount || 0) - parseFloat(form.planned_amount || 0)).toFixed(2),
        )
      : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category_id) {
      setError('Select a category')
      return
    }
    if (!form.expense_name.trim()) {
      setError('Expense name is required')
      return
    }
    const selectedCat = categories.find((c) => c.id === form.category_id)
    const isHrDirectlyLinked = selectedCat && HR_CATEGORY_NAMES.has(selectedCat.name)
    if (!isHrDirectlyLinked && (form.planned_amount === '' || isNaN(parseFloat(form.planned_amount)))) {
      setError('Planned amount is required')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      category_id: form.category_id,
      expense_name: form.expense_name.trim(),
      month: parseInt(form.month),
      year: parseInt(form.year),
      frequency: form.frequency,
      planned_amount: isHrDirectlyLinked ? 0 : parseFloat(form.planned_amount),
      actual_amount: parseFloat(form.actual_amount || 0),
      status: form.status,
      remarks: form.remarks.trim() || null,
    }

    try {
      if (isEdit) {
        await api.patch(`/general-expenses/${id}`, payload)
      } else {
        await api.post('/general-expenses', payload)
      }
      navigate('/ems/general-expenses')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Save failed'
      try {
        if (isEdit) {
          await localGeneralExpenses.expenses.update(id, payload)
        } else {
          await localGeneralExpenses.expenses.create(payload)
        }
        navigate('/ems/general-expenses')
      } catch (localErr) {
        setError(localErr.message || msg)
        setSaving(false)
      }
    }
  }

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner />
      </div>
    )

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <CButton color="link" className="p-0" onClick={() => navigate('/ems/general-expenses')}>
          <CIcon icon={cilArrowLeft} className="me-1" /> Back
        </CButton>
        <strong className="fs-5">{isEdit ? 'Edit Expense Record' : 'Add Expense Record'}</strong>
      </div>

      <CCard style={{ maxWidth: 720 }}>
        <CCardHeader>
          <strong>{isEdit ? 'Edit' : 'New'} General Expense</strong>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError('')}>
              {error}
            </CAlert>
          )}

          <CForm onSubmit={handleSubmit}>
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Category <span className="text-danger">*</span>
                </CFormLabel>
                <CFormSelect
                  value={form.category_id}
                  onChange={(e) => set('category_id', e.target.value)}
                  required
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Expense Name <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.expense_name}
                  onChange={(e) => set('expense_name', e.target.value)}
                  placeholder="e.g. Office Internet - BSNL"
                  required
                />
              </CCol>

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Month</CFormLabel>
                <CFormSelect
                  value={form.month}
                  onChange={(e) => set('month', parseInt(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.l}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Year</CFormLabel>
                <CFormSelect
                  value={form.year}
                  onChange={(e) => set('year', parseInt(e.target.value))}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Frequency</CFormLabel>
                <CFormSelect
                  value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              {!(categories.find((c) => c.id === form.category_id) && HR_CATEGORY_NAMES.has(categories.find((c) => c.id === form.category_id).name)) && (
                <CCol sm={4}>
                  <CFormLabel className="fw-semibold">
                    Planned Amount (₹) <span className="text-danger">*</span>
                  </CFormLabel>
                  <CFormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.planned_amount}
                    onChange={(e) => set('planned_amount', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </CCol>
              )}

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Actual Amount (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_amount}
                  onChange={(e) => set('actual_amount', e.target.value)}
                  placeholder="0.00"
                />
              </CCol>

              {!(categories.find((c) => c.id === form.category_id) && HR_CATEGORY_NAMES.has(categories.find((c) => c.id === form.category_id).name)) && (
                <CCol sm={4}>
                  <CFormLabel className="fw-semibold">Variance</CFormLabel>
                  <div
                    className={`form-control bg-body-secondary ${variance === null ? '' : variance > 0 ? 'text-danger' : variance < 0 ? 'text-success' : ''}`}
                    style={{ userSelect: 'none' }}
                  >
                    {variance === null
                      ? '—'
                      : `${variance > 0 ? '+' : ''}${new Intl.NumberFormat('en-IN').format(variance)}`}
                  </div>
                  <div className="form-text">Actual − Planned (auto)</div>
                </CCol>
              )}

              <CCol sm={6}>
                <CFormLabel className="fw-semibold">Status</CFormLabel>
                <CFormSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={12}>
                <CFormLabel>Remarks</CFormLabel>
                <CFormTextarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => set('remarks', e.target.value)}
                  placeholder="Optional notes"
                />
              </CCol>
            </CRow>

            <div className="d-flex gap-2 mt-4">
              <CButton type="submit" color="primary" disabled={saving}>
                {saving ? (
                  <CSpinner size="sm" className="me-1" />
                ) : (
                  <CIcon icon={cilSave} className="me-1" />
                )}
                {isEdit ? 'Save Changes' : 'Create Expense'}
              </CButton>
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                onClick={() => navigate('/ems/general-expenses')}
                disabled={saving}
              >
                Cancel
              </CButton>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </>
  )
}

export default GeneralExpenseForm
