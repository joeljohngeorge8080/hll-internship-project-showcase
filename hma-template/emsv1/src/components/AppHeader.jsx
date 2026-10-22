import React, { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CBadge,
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilContrast, cilMenu, cilMoon, cilSun, cilBell } from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'
import HeaderSearch from './HeaderSearch'
import useRole from '../hooks/useRole'
import useUnreadAnnouncements from '../hooks/useUnreadAnnouncements'
import { ROLE } from '../constants/roles'

const AppHeader = ({ nav = [] }) => {
  const headerRef = useRef()
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const navigate = useNavigate()
  const location = useLocation()

  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const role = useRole()
  const unread = useUnreadAnnouncements()

  const isEms = location.pathname.startsWith('/ems')
  const announcementsPath = role === ROLE.CEO ? '/ems/announcements' : '/ems/notifications'
  const showBell = isEms && role && role !== ROLE.ADMIN

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }

    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderNav className="ms-auto">
          {showBell && (
            <li className="nav-item">
              <button
                className="nav-link position-relative px-2 btn btn-link border-0"
                title="Announcements"
                onClick={() => navigate(announcementsPath)}
                style={{ color: 'inherit' }}
              >
                <CIcon icon={cilBell} size="lg" />
                {unread > 0 && (
                  <CBadge
                    color="danger"
                    shape="rounded-pill"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 2,
                      fontSize: 10,
                      padding: '1px 5px',
                      minWidth: 16,
                    }}
                  >
                    {unread > 99 ? '99+' : unread}
                  </CBadge>
                )}
              </button>
            </li>
          )}
          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false}>
              {colorMode === 'dark' ? (
                <CIcon icon={cilMoon} size="lg" />
              ) : colorMode === 'auto' ? (
                <CIcon icon={cilContrast} size="lg" />
              ) : (
                <CIcon icon={cilSun} size="lg" />
              )}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem
                active={colorMode === 'light'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('light')}
              >
                <CIcon className="me-2" icon={cilSun} size="lg" /> Light
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'dark'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('dark')}
              >
                <CIcon className="me-2" icon={cilMoon} size="lg" /> Dark
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'auto'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('auto')}
              >
                <CIcon className="me-2" icon={cilContrast} size="lg" /> Auto
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
      <CContainer className="px-4 d-flex align-items-center" fluid>
        <AppBreadcrumb />
        <div className="ms-auto">
          <HeaderSearch nav={nav} />
        </div>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
