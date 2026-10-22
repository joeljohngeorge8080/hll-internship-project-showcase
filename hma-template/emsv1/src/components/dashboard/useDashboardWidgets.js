import { useState, useCallback } from 'react'

const storageKey = (dashboardId) => `hma_dashboard_widgets_${dashboardId}`

const read = (key, defaults) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaults
  } catch {
    return defaults
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // silent — non-critical persistence
  }
}

/**
 * @param {string}   dashboardId  Unique key for this dashboard's localStorage slot.
 * @param {object[]} allWidgets   All widget definitions.
 * @param {string[]} [defaultIds] IDs to activate by default (all widgets if omitted).
 */
const useDashboardWidgets = (dashboardId, allWidgets, defaultIds) => {
  const key = storageKey(dashboardId)
  const allIds = allWidgets.map((w) => w.id)
  const fallbackIds = defaultIds ?? allIds

  const [activeIds, setActiveIds] = useState(() => {
    const saved = read(key, null)
    if (saved) {
      // Auto-add any brand-new widget IDs that aren't in the saved list yet
      const newIds = allIds.filter((id) => !saved.includes(id))
      // Only auto-add new IDs that are also in the CEO default set
      const newCeoIds = newIds.filter((id) => fallbackIds.includes(id))
      if (newCeoIds.length > 0) {
        const merged = [...saved, ...newCeoIds]
        write(key, merged)
        return merged
      }
      return saved
    }
    write(key, fallbackIds)
    return fallbackIds
  })

  const toggleWidget = useCallback(
    (widgetId) => {
      setActiveIds((prev) => {
        const next = prev.includes(widgetId)
          ? prev.filter((id) => id !== widgetId)
          : [...prev, widgetId]
        write(key, next)
        return next
      })
    },
    [key],
  )

  const resetWidgets = useCallback(() => {
    write(key, fallbackIds)
    setActiveIds(fallbackIds)
  }, [key, fallbackIds])

  const activeWidgets = allWidgets.filter((w) => activeIds.includes(w.id))

  return { activeIds, activeWidgets, toggleWidget, resetWidgets }
}

export default useDashboardWidgets

