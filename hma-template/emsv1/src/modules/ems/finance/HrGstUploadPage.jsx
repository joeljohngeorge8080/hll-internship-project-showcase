import React from 'react'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import GstBillsView from './components/GstBillsView'

// HR Admin's GST bill intake: same upload + basic-field editing as
// Finance's GST Bills page, minus Accounted status / Eligibility — those
// stay Head-of-Finance-only and are set on the Finance > GST Bills page.
const HrGstUploadPage = () => {
  const canView = usePermission(MODULE.GST_UPLOAD, 'view')
  const canEdit = usePermission(MODULE.GST_UPLOAD, 'edit')

  return (
    <GstBillsView
      title="Upload GST Bill"
      canView={canView}
      canEdit={canEdit}
      showFinanceFields={false}
      // HR-uploaded bills default to Department = HR when the sheet
      // doesn't already specify one.
      defaultDepartment="HR"
    />
  )
}

export default HrGstUploadPage
