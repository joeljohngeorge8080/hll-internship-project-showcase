import React from 'react'
import PropTypes from 'prop-types'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import GstBillsView from './components/GstBillsView'

const GstBillsPage = ({ projectId = null, isProjectView = false }) => {
  const canView = usePermission(MODULE.FINANCE, 'view')
  const canEdit = usePermission(MODULE.FINANCE, 'edit')

  return (
    <GstBillsView
      title="GST Bills — Input Tax Credit"
      canView={canView}
      canEdit={canEdit}
      // Embedded in a Project's Financials tab: same stripped-down shape as
      // HR's "Upload GST Bill" page — no Accounted/Eligibility, those stay
      // Finance-only and are set from the main GST Bills page.
      showFinanceFields={!isProjectView}
      projectId={projectId}
      isProjectView={isProjectView}
      // Bills uploaded from a project's Financials tab are project/CSR
      // expenses — default Department and Vertical to CSR when the sheet
      // doesn't already specify them.
      defaultDepartment={isProjectView ? 'CSR' : ''}
      defaultVertical={isProjectView ? 'CSR' : ''}
    />
  )
}

GstBillsPage.propTypes = {
  projectId: PropTypes.string,
  isProjectView: PropTypes.bool,
}

export default GstBillsPage
