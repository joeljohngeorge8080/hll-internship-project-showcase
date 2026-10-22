import React, { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'

import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react'
import { AppSidebarNav } from './AppSidebarNav'

import hmaLogo from 'src/assets/brand/hma-logo.png'

import useRole from '../hooks/useRole'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const SidebarClock = () => {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const day = DAYS[now.getDay()]
  const date = now.getDate()
  const month = MONTHS[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = String(hours % 12 || 12).padStart(2, '0')

  return (
    <div className="sidebar-clock">
      <div className="sidebar-clock__time">
        {displayHours}:{minutes}:{seconds}
        <span className="sidebar-clock__ampm">{ampm}</span>
      </div>
      <div>{day}</div>
      <div>
        {date} {month} {year}
      </div>
    </div>
  )
}

const AppSidebar = ({ nav = [] }) => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const role = useRole()
  const { pathname } = useLocation()
  const dashboardPath = pathname.startsWith('/pms') ? '/pms/dashboard' : '/ems/dashboard'

  const visibleNavigation = nav
    .filter((item) => !item.roles || !role || item.roles.includes(role))
    .map(({ roles, ...item }) => item)

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand as={Link} to={dashboardPath}>
          <img
            src={hmaLogo}
            alt="HMA"
            height={40}
            className="sidebar-brand-full"
            style={{ objectFit: 'contain' }}
          />
          <img
            src={hmaLogo}
            alt="HMA"
            height={32}
            className="sidebar-brand-narrow"
            style={{ objectFit: 'contain' }}
          />
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>

      <AppSidebarNav items={visibleNavigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex flex-column p-0">
        {!unfoldable && <SidebarClock />}
        <div className="d-flex">
          <CSidebarToggler
            onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
          />
        </div>
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
