/**
 * ReportForm — Shared form for submit and resubmit flows.
 *
 * Mobile-first single-column layout with dual upload areas
 * (geo-tagged photos + bills). Uses react-hook-form for validation.
 */
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CFormFeedback,
  CFormSelect,
  CButton,
  CSpinner,
  CRow,
  CCol,
  CAlert,
  CInputGroup,
  CInputGroupText,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSave, cilSend, cilWarning, cilTrash, cilPlus, cilLocationPin } from '@coreui/icons'

import ImageUploadWithPreview from './ImageUploadWithPreview'

const ReportForm = ({
  defaultValues = {},
  isResubmit = false,
  declineReason = '',
  onSubmit,
  onSaveDraft,
  loading = false,
}) => {
  const today = new Date().toISOString().split('T')[0]
  const nowTime = new Date().toTimeString().slice(0, 5)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      bill_topic: defaultValues.bill_topic || '',
      amount: defaultValues.amount || '',
      report_date: defaultValues.report_date || today,
      report_time: defaultValues.report_time || nowTime,
      notes: defaultValues.notes || '',
      meetings: defaultValues.meetings || [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'meetings',
  })

  const [geoPhotos, setGeoPhotos] = useState(defaultValues.geo_photos || [])
  const [billUploads, setBillUploads] = useState(defaultValues.bill_uploads || [])
  const [submitError, setSubmitError] = useState(null)

  const handleFormSubmit = async (data) => {
    setSubmitError(null)
    try {
      await onSubmit({ ...data, geo_photos: geoPhotos, bill_uploads: billUploads })
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit report')
    }
  }

  const handleDraft = () => {
    const data = {
      bill_topic: watch('bill_topic'),
      amount: watch('amount'),
      report_date: watch('report_date'),
      report_time: watch('report_time'),
      notes: watch('notes'),
      meetings: watch('meetings'),
      geo_photos: geoPhotos,
      bill_uploads: billUploads,
    }
    onSaveDraft?.(data)
  }

  return (
    <CCard className="daily-report-form-card shadow-sm">
      <CCardHeader className="bg-transparent border-bottom-0 pt-3">
        <h5 className="mb-0 fw-semibold">
          {isResubmit ? 'Resubmit Daily Report' : 'Submit Daily Report'}
        </h5>
        {isResubmit && (
          <div className="small text-body-secondary mt-1">Editing a previously declined report</div>
        )}
      </CCardHeader>
      <CCardBody className="pt-2">
        {isResubmit && declineReason && (
          <CAlert color="danger" className="d-flex align-items-start gap-2 mb-4">
            <CIcon icon={cilWarning} className="flex-shrink-0 mt-1" />
            <div>
              <strong className="d-block mb-1">Decline Reason:</strong>
              {declineReason}
            </div>
          </CAlert>
        )}

        {submitError && (
          <CAlert color="danger" dismissible onClose={() => setSubmitError(null)}>
            {submitError}
          </CAlert>
        )}

        <CForm onSubmit={handleSubmit(handleFormSubmit)}>
          {/* Bill Topic */}
          <div className="mb-3">
            <CFormLabel htmlFor="bill_topic" className="fw-medium">
              Bill Topic / Description <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              id="bill_topic"
              placeholder="e.g. Site inspection — Block A foundation"
              invalid={!!errors.bill_topic}
              {...register('bill_topic', {
                required: 'Bill topic is required',
                maxLength: { value: 200, message: 'Maximum 200 characters' },
              })}
            />
            {errors.bill_topic && (
              <CFormFeedback invalid>{errors.bill_topic.message}</CFormFeedback>
            )}
          </div>

          {/* Amount */}
          <div className="mb-3">
            <CFormLabel htmlFor="amount" className="fw-medium">
              Amount <span className="text-danger">*</span>
            </CFormLabel>
            <CInputGroup>
              <CInputGroupText>₹</CInputGroupText>
              <CFormInput
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                invalid={!!errors.amount}
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                })}
              />
            </CInputGroup>
            {errors.amount && (
              <CFormFeedback invalid className="d-block">
                {errors.amount.message}
              </CFormFeedback>
            )}
          </div>

          {/* Date and Time */}
          <CRow className="mb-3">
            <CCol xs={12} md={6}>
              <CFormLabel htmlFor="report_date" className="fw-medium">
                Date <span className="text-danger">*</span>
              </CFormLabel>
              <CFormInput
                id="report_date"
                type="date"
                invalid={!!errors.report_date}
                {...register('report_date', { required: 'Date is required' })}
              />
              {errors.report_date && (
                <CFormFeedback invalid>{errors.report_date.message}</CFormFeedback>
              )}
            </CCol>
            <CCol xs={12} md={6} className="mt-3 mt-md-0">
              <CFormLabel htmlFor="report_time" className="fw-medium">
                Time <span className="text-danger">*</span>
              </CFormLabel>
              <CFormInput
                id="report_time"
                type="time"
                invalid={!!errors.report_time}
                {...register('report_time', { required: 'Time is required' })}
              />
              {errors.report_time && (
                <CFormFeedback invalid>{errors.report_time.message}</CFormFeedback>
              )}
            </CCol>
          </CRow>

          {/* Details of Meetings Conducted */}
          <div className="mb-4">
            <CFormLabel className="fw-medium">Details of Meetings Conducted (with LSGB)</CFormLabel>
            <div className="table-responsive border rounded mb-2">
              <CTable align="middle" className="mb-0" hover>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell className="text-center" style={{ width: '60px' }}>
                      Sl. No
                    </CTableHeaderCell>
                    <CTableHeaderCell>Particulars</CTableHeaderCell>
                    <CTableHeaderCell>Venue Address</CTableHeaderCell>
                    <CTableHeaderCell>Local Point of Contact (Name, Contact No)</CTableHeaderCell>
                    <CTableHeaderCell>Remarks</CTableHeaderCell>
                    <CTableHeaderCell
                      className="text-center"
                      style={{ width: '60px' }}
                    ></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {fields.map((field, index) => (
                    <CTableRow key={field.id}>
                      <CTableDataCell className="text-center fw-medium text-body-secondary">
                        {index + 1}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          size="sm"
                          placeholder="e.g. Discussed project plan"
                          {...register(`meetings.${index}.particulars`, { required: 'Required' })}
                          invalid={!!errors?.meetings?.[index]?.particulars}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          size="sm"
                          placeholder="e.g. City Hall, Room 101"
                          {...register(`meetings.${index}.venue_address`, { required: 'Required' })}
                          invalid={!!errors?.meetings?.[index]?.venue_address}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          size="sm"
                          placeholder="e.g. John Doe, 9876543210"
                          {...register(`meetings.${index}.local_contact`, { required: 'Required' })}
                          invalid={!!errors?.meetings?.[index]?.local_contact}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          size="sm"
                          placeholder="Optional"
                          {...register(`meetings.${index}.remarks`)}
                        />
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  {fields.length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan="6" className="text-center text-body-secondary py-4">
                        No meetings added yet.
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </div>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ particulars: '', venue_address: '', local_contact: '', remarks: '' })
              }
            >
              <CIcon icon={cilPlus} className="me-1" /> Add Meeting
            </CButton>
          </div>

          {/* Geo-tagged Photos Upload */}
          <div className="mb-3">
            <CFormLabel className="fw-medium">
              <CIcon icon={cilLocationPin} size="sm" className="me-1" />
              Geo-tagged Photos
            </CFormLabel>
            <div className="text-body-tertiary mb-2" style={{ fontSize: '0.75rem' }}>
              Upload site photos with embedded GPS location data
            </div>
            <ImageUploadWithPreview value={geoPhotos} onChange={setGeoPhotos} />
          </div>

          {/* Bills / Receipts Upload */}
          <div className="mb-3">
            <CFormLabel className="fw-medium">🧾 Bills / Receipts</CFormLabel>
            <div className="text-body-tertiary mb-2" style={{ fontSize: '0.75rem' }}>
              Upload scanned bills, invoices, or receipts
            </div>
            <ImageUploadWithPreview value={billUploads} onChange={setBillUploads} />
          </div>

          {/* Notes */}
          <div className="mb-4">
            <CFormLabel htmlFor="notes" className="fw-medium">
              Notes / Remarks
            </CFormLabel>
            <CFormTextarea
              id="notes"
              rows={3}
              placeholder="Additional details about this expense..."
              invalid={!!errors.notes}
              {...register('notes', {
                maxLength: { value: 500, message: 'Maximum 500 characters' },
              })}
            />
            {errors.notes && <CFormFeedback invalid>{errors.notes.message}</CFormFeedback>}
            <div className="text-body-tertiary mt-1" style={{ fontSize: '0.75rem' }}>
              {watch('notes')?.length || 0}/500 characters
            </div>
          </div>

          {/* Action buttons */}
          <div className="daily-report-form-actions">
            <div className="d-flex gap-2 flex-wrap">
              {onSaveDraft && (
                <CButton
                  color="secondary"
                  variant="outline"
                  type="button"
                  onClick={handleDraft}
                  disabled={loading}
                >
                  <CIcon icon={cilSave} className="me-1" />
                  Save Draft
                </CButton>
              )}
              <CButton
                color="primary"
                type="submit"
                disabled={loading}
                className="flex-grow-1 flex-md-grow-0"
              >
                {loading ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CIcon icon={cilSend} className="me-1" />
                    {isResubmit ? 'Resubmit Report' : 'Submit Report'}
                  </>
                )}
              </CButton>
            </div>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

ReportForm.propTypes = {
  defaultValues: PropTypes.object,
  isResubmit: PropTypes.bool,
  declineReason: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onSaveDraft: PropTypes.func,
  loading: PropTypes.bool,
}

export default ReportForm
