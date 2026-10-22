import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import useRole from '../hooks/useRole'

const flattenNav = (items, parentName = null) => {
  const results = []
  for (const item of items) {
    if (item.to) results.push({ name: item.name, to: item.to, parent: parentName })
    if (item.items?.length) results.push(...flattenNav(item.items, item.name))
  }
  return results
}

const HeaderSearch = ({ nav = [] }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const navigate = useNavigate()
  const role = useRole()
  const ref = useRef(null)

  const visibleNav = nav.filter((item) => !item.roles || !role || item.roles.includes(role))
  const allItems = flattenNav(visibleNav)

  const results = query.trim()
    ? allItems.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : []

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (to) => {
    navigate(to)
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: focused ? 340 : 260,
        transition: 'width 250ms ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          borderRadius: 9999,
          border: `1.5px solid ${focused ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
          background: 'var(--cui-body-bg)',
          padding: '0 14px',
          gap: 8,
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          boxShadow: focused ? '0 0 0 3px rgba(37, 99, 235, 0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <CIcon
          icon={cilSearch}
          size="sm"
          style={{
            color: focused ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
            flexShrink: 0,
            transition: 'color 200ms ease',
          }}
        />
        <input
          type="search"
          placeholder="Search..."
          value={query}
          autoComplete="off"
          aria-label="Search navigation"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            if (query.trim()) setOpen(true)
          }}
          onBlur={() => setFocused(false)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--cui-body-color)',
            fontSize: '0.8125rem',
            width: '100%',
            minWidth: 0,
          }}
        />
      </div>

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            background: 'var(--cui-body-bg)',
            border: '1px solid var(--cui-border-color)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {results.map((item, idx) => (
            <button
              key={idx}
              className="d-block w-100 text-start border-0 bg-transparent"
              style={{ padding: '9px 16px', cursor: 'pointer' }}
              onMouseDown={() => handleSelect(item.to)}
            >
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--cui-body-color)',
                  lineHeight: 1.3,
                }}
              >
                {item.name}
              </div>
              {item.parent && (
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--cui-secondary-color)',
                    marginTop: 2,
                  }}
                >
                  {item.parent}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            background: 'var(--cui-body-bg)',
            border: '1px solid var(--cui-border-color)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '12px 16px',
            fontSize: '0.8125rem',
            color: 'var(--cui-secondary-color)',
          }}
        >
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}

export default HeaderSearch
