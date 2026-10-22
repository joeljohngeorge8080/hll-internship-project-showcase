import React, { useState } from 'react'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormInput,
  CFormTextarea,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload } from '@coreui/icons'
import UploadBillModal from './components/UploadBillModal'

const FieldPersonnelBillsPage = () => {
  const [bills, setBills] = useState([
    {
      id: 1,
      date: '2026-06-18',
      reason: 'Site Inspection Travel Allowance',
      amount: 1500,
      status: 'Pending',
      file: 'receipt_01.jpg',
    },
  ])

  const [modalVisible, setModalVisible] = useState(false)

  const handleUploadBill = (formData) => {
    const newBill = {
      id: Date.now(),
      date: formData.date,
      reason: formData.reason,
      amount: formData.amount,
      status: 'Pending',
      file: formData.file ? formData.file.name : 'No file attached',
    }
    setBills([newBill, ...bills])
    setModalVisible(false)
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-semibold mb-0">My Bills & Expenses</h4>
        <CButton color="primary" onClick={() => setModalVisible(true)}>
          <CIcon icon={cilCloudUpload} className="me-2" />
          Upload New Bill
        </CButton>
      </div>

      <CRow className="g-4">
        {/* History Table */}
        <CCol xs={12}>
          <CCard className="shadow-sm h-100">
            <CCardHeader className="pb-0 border-bottom">
              <h6 className="fw-semibold mb-3">Submission History</h6>
            </CCardHeader>
            <CCardBody>
              <CTable hover responsive align="middle">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Date</CTableHeaderCell>
                    <CTableHeaderCell>Reason</CTableHeaderCell>
                    <CTableHeaderCell>Amount</CTableHeaderCell>
                    <CTableHeaderCell>Proof</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {bills.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan="5" className="text-center text-body-secondary py-4">
                        No bills submitted yet.
                      </CTableDataCell>
                    </CTableRow>
                  ) : (
                    bills.map((b) => (
                      <CTableRow key={b.id}>
                        <CTableDataCell className="small">{b.date}</CTableDataCell>
                        <CTableDataCell>
                          <div className="fw-medium small">{b.reason}</div>
                        </CTableDataCell>
                        <CTableDataCell className="fw-semibold">₹{b.amount}</CTableDataCell>
                        <CTableDataCell className="small text-body-secondary">
                          <CIcon icon={cilCloudUpload} className="me-1" size="sm" />
                          {b.file}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge
                            color={b.status === 'Pending' ? 'warning' : 'success'}
                            shape="rounded-pill"
                          >
                            {b.status}
                          </CBadge>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <UploadBillModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleUploadBill}
      />
    </>
  )
}

export default FieldPersonnelBillsPage
