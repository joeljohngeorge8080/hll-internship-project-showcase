import React, { useEffect, useState } from 'react'
import { AppContent, AppSidebar, AppFooter, AppHeader } from '../components/index'
import { RoutesContext } from '../contexts/RoutesContext'
import emsNav from '../modules/ems/_nav'
import { emsRoutes } from '../routes/ems.routes'
import MaintenanceBanner from '../modules/ems/admin/MaintenanceBanner'
import MaintenancePage from '../modules/ems/admin/MaintenancePage'
import FloatingCalculator from '../components/FloatingCalculator'
import { localAdminSettings } from '../services/localAdminSettings'
import useRole from '../hooks/useRole'
import { ROLE } from '../constants/roles'

// Roles that are locked to EMS (no system-selection screen) don't need the
// switcher link — hide it so they don't land on a screen they can't use.
const NO_SWITCH_ROLES = [ROLE.HEADS, ROLE.HR, ROLE.EMPLOYEE, ROLE.PROJECT_OFFICER]

const EmsLayout = () => {
  const role = useRole()
  const [maintenance, setMaintenance] = useState({
    maintenance_mode: false,
    maintenance_message: '',
  })

  useEffect(() => {
    let cancelled = false
    const poll = () => localAdminSettings.get().then((next) => !cancelled && setMaintenance(next))
    poll()
    const id = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Non-admin users see the maintenance page when mode is active
  if (maintenance.maintenance_mode && role !== ROLE.ADMIN) {
    return <MaintenancePage message={maintenance.maintenance_message} />
  }

  const filteredNav = NO_SWITCH_ROLES.includes(role)
    ? emsNav.filter((item) => item.name !== 'Switch to PMS')
    : emsNav

  return (
    <RoutesContext.Provider value={emsRoutes}>
      <div>
        <AppSidebar nav={filteredNav} />
        <div className="wrapper d-flex flex-column min-vh-100">
          <MaintenanceBanner />
          <AppHeader nav={filteredNav} />
          <div className="body flex-grow-1">
            <AppContent />
          </div>
          <AppFooter />
        </div>
        <FloatingCalculator />
      </div>
    </RoutesContext.Provider>
  )
}

export default EmsLayout
