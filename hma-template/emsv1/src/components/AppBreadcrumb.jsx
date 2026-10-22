import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'

import { useRoutes } from '../contexts/RoutesContext'

const AppBreadcrumb = () => {
  const routes = useRoutes()
  const currentLocation = useLocation().pathname

  const getRouteName = (pathname) => {
    const route = routes.find((r) => r.path === pathname)
    return route ? route.name : false
  }

  const getBreadcrumbs = (location) => {
    const breadcrumbs = []
    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`
      const routeName = getRouteName(currentPathname)
      routeName &&
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length,
        })
      return currentPathname
    })
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(currentLocation)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem>
        <Link to="/" className="text-decoration-none">Home</Link>
      </CBreadcrumbItem>
      {breadcrumbs.map((breadcrumb, index) => (
        <CBreadcrumbItem
          active={breadcrumb.active}
          key={index}
        >
          {breadcrumb.active ? (
            breadcrumb.name
          ) : (
            <Link to={breadcrumb.pathname} className="text-decoration-none">
              {breadcrumb.name}
            </Link>
          )}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
