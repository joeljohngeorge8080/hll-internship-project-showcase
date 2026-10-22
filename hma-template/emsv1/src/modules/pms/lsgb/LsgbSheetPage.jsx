/**
 * LsgbSheetPage.jsx — LSGB Projects
 * Route: /pms/lsgb
 *
 * File storage page for LSGB Projects documentation and supporting files.
 */
import React from 'react'
import { useSelector } from 'react-redux'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localLsgbDocuments } from '../../../services/localLsgbDocuments'
import DocumentLibraryPanel from '../../ems/shared/DocumentLibraryPanel'

const LsgbSheetPage = () => {
  const currentUser = useSelector((s) => s.user)
  const currentUserName = currentUser?.full_name || currentUser?.employee_id || 'Unknown'
  const canEdit = usePermission(MODULE.PMS_PROJECTS, 'edit')

  return (
    <>
      <div className="mb-3">
        <h4 className="fw-bold mb-1">LSGB Projects</h4>
        <p className="text-body-secondary small mb-0">
          Store and manage project files and documentation.
        </p>
      </div>

      <DocumentLibraryPanel
        documentsService={localLsgbDocuments}
        title="Files"
        canEdit={canEdit}
        currentUser={currentUserName}
      />
    </>
  )
}

export default LsgbSheetPage
