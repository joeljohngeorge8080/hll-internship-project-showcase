/**
 * FinanceFilesPage.jsx — Finance > Files
 * Route: /ems/finance/files
 */
import React from 'react'
import { useSelector } from 'react-redux'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localFinanceDocuments } from '../../../services/localFinanceDocuments'
import DocumentLibraryPanel from '../shared/DocumentLibraryPanel'

const FinanceFilesPage = () => {
  const canEdit = usePermission(MODULE.FINANCE, 'edit')
  const currentUser = useSelector((s) => s.user)
  const currentUserName = currentUser?.full_name || currentUser?.employee_id || 'Unknown'

  return (
    <>
      <div className="mb-3">
        <h4 className="fw-bold mb-1">Finance Files</h4>
        <p className="text-body-secondary small mb-0">
          Store and manage finance-related documents.
        </p>
      </div>

      <DocumentLibraryPanel
        documentsService={localFinanceDocuments}
        title="Files"
        canEdit={canEdit}
        currentUser={currentUserName}
      />
    </>
  )
}

export default FinanceFilesPage
