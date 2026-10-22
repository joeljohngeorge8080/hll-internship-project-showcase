import { createContext, useContext } from 'react'

export const RoutesContext = createContext([])

export const useRoutes = () => useContext(RoutesContext)
