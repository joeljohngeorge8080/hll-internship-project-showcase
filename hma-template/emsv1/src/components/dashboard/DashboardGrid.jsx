import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { CRow, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChartPie } from '@coreui/icons'

// Inject shimmer keyframes once into the document head
const SHIMMER_STYLE_ID = 'dashboard-shimmer-style'
const injectShimmerStyles = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(SHIMMER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SHIMMER_STYLE_ID
  style.textContent = `
    @keyframes dashboardShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .widget-skeleton {
      background: linear-gradient(
        90deg,
        var(--cui-tertiary-bg, #f0f0f0) 25%,
        var(--cui-secondary-bg, #e0e0e0) 50%,
        var(--cui-tertiary-bg, #f0f0f0) 75%
      );
      background-size: 800px 100%;
      animation: dashboardShimmer 1.4s ease-in-out infinite;
      border-radius: 12px;
    }
  `
  document.head.appendChild(style)
}

const WidgetSkeleton = ({ colProps }) => (
  <CCol {...colProps}>
    <div className="widget-skeleton" style={{ height: 160 }} />
  </CCol>
)

// Reports whether a widget actually rendered visible content, by watching its
// DOM node for children — most dashboard widgets `return null` while their
// data hasn't loaded (or has failed to load), so an empty node means the
// widget isn't really showing anything, regardless of whether it's "active".
const WidgetSlot = ({ widget, onRenderedChange }) => {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const report = () => onRenderedChange(widget.id, el.childElementCount > 0)
    report()

    const observer = new MutationObserver(report)
    observer.observe(el, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      onRenderedChange(widget.id, false)
    }
  }, [widget.id, onRenderedChange])

  const Component = widget.component
  return (
    <Suspense fallback={<WidgetSkeleton colProps={widget.colProps} />}>
      <CCol {...widget.colProps}>
        <div ref={containerRef}>
          <Component />
        </div>
      </CCol>
    </Suspense>
  )
}

const DashboardGrid = ({ activeWidgets, onRenderedCountChange }) => {
  useEffect(() => {
    injectShimmerStyles()
  }, [])

  const [renderedIds, setRenderedIds] = useState(() => new Set())

  const handleRenderedChange = useCallback((id, hasContent) => {
    setRenderedIds((prev) => {
      if (prev.has(id) === hasContent) return prev
      const next = new Set(prev)
      if (hasContent) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    onRenderedCountChange?.(renderedIds.size)
  }, [renderedIds, onRenderedCountChange])

  if (activeWidgets.length === 0) {
    return (
      <div className="text-center py-5 text-body-secondary">
        <CIcon
          icon={cilChartPie}
          style={{ width: 42, height: 42, marginBottom: 10, opacity: 0.5 }}
        />
        <p className="mb-0">
          No widgets selected. Click <strong>Customize</strong> to add some.
        </p>
      </div>
    )
  }

  return (
    <CRow className="g-3">
      {activeWidgets.map((widget) => (
        <WidgetSlot key={widget.id} widget={widget} onRenderedChange={handleRenderedChange} />
      ))}
    </CRow>
  )
}

export default DashboardGrid
