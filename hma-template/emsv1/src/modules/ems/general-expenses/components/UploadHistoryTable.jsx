import React from 'react'
import {
  CBadge,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const MONTHS = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const statusColor = (s) => {
  if (s === 'Done') return 'success'
  if (s === 'Processing') return 'warning'
  if (s === 'Done with errors') return 'warning'
  return 'danger'
}

const UploadHistoryTable = ({ uploads }) => {
  if (!uploads || uploads.length === 0) {
    return <p className="text-body-secondary small">No uploads yet.</p>
  }

  return (
    <CTable small hover responsive>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>File</CTableHeaderCell>
          <CTableHeaderCell>Period</CTableHeaderCell>
          <CTableHeaderCell>Rows</CTableHeaderCell>
          <CTableHeaderCell>Status</CTableHeaderCell>
          <CTableHeaderCell>Uploaded At</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {uploads.map((u) => (
          <CTableRow key={u.id}>
            <CTableDataCell className="text-truncate" style={{ maxWidth: 200 }}>
              {u.file_name}
            </CTableDataCell>
            <CTableDataCell>
              {MONTHS[u.month]} {u.year}
            </CTableDataCell>
            <CTableDataCell>{u.row_count}</CTableDataCell>
            <CTableDataCell>
              <CBadge color={statusColor(u.status)}>{u.status}</CBadge>
            </CTableDataCell>
            <CTableDataCell>
              {new Date(u.uploaded_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
  )
}

export default UploadHistoryTable
