import React, { useCallback, useEffect, useRef, useState } from 'react'
import CIcon from '@coreui/icons-react'
import { cilCalculator, cilTrash, cilX } from '@coreui/icons'
import { localCalculator } from '../services/localCalculator'

// ── Colours that respect CoreUI's CSS variables ───────────────────────────────

const BTN = {
  num: {
    bg: 'var(--cui-body-bg)',
    hover: 'var(--cui-tertiary-bg)',
    color: 'var(--cui-body-color)',
  },
  op: {
    bg: 'rgba(50,121,243,0.1)',
    hover: 'rgba(50,121,243,0.2)',
    color: '#3279f3',
  },
  eq: {
    bg: '#3279f3',
    hover: '#1f5fd4',
    color: '#fff',
  },
  clear: {
    bg: 'rgba(229,83,83,0.12)',
    hover: 'rgba(229,83,83,0.22)',
    color: '#e55353',
  },
  fn: {
    bg: 'var(--cui-tertiary-bg)',
    hover: 'var(--cui-secondary-bg)',
    color: 'var(--cui-body-color)',
  },
}

// ── Calculator logic ──────────────────────────────────────────────────────────

const MAX_DISPLAY = 14

const safeEval = (expr) => {
  // Replace × ÷ with * /
  const cleaned = expr.replace(/×/g, '*').replace(/÷/g, '/')
  // Allow only safe characters
  if (!/^[0-9+\-*/.() ]+$/.test(cleaned)) throw new Error('Invalid')
  const result = Function(`"use strict"; return (${cleaned})`)()
  if (!isFinite(result)) throw new Error('Math error')
  return result
}

const formatResult = (n) => {
  if (typeof n !== 'number') return String(n)
  const s = String(n)
  if (s.length <= MAX_DISPLAY) return s
  return parseFloat(n.toPrecision(10)).toString()
}

// ── Button component ──────────────────────────────────────────────────────────

const CalcBtn = ({ label, onClick, span = 1, variant = 'num', disabled = false }) => {
  const [hovered, setHovered] = useState(false)
  const style = BTN[variant] || BTN.num
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: span > 1 ? `span ${span}` : undefined,
        background: hovered ? style.hover : style.bg,
        color: style.color,
        border: '1px solid var(--cui-border-color)',
        borderRadius: 6,
        padding: '10px 4px',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.12s',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

const fmt = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

const HistoryTab = ({ onRecall }) => {
  const [history, setHistory] = useState(() => localCalculator.getHistory())

  const clear = () => {
    localCalculator.clearHistory()
    setHistory([])
  }

  // Keep in sync when entries are added
  useEffect(() => {
    const id = setInterval(() => setHistory(localCalculator.getHistory()), 1500)
    return () => clearInterval(id)
  }, [])

  if (history.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 220,
          color: 'var(--cui-secondary-color)',
          fontSize: 13,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 28 }}>🧮</span>
        No calculations yet
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 10px 4px',
        }}
      >
        <button
          onClick={clear}
          style={{
            background: 'none',
            border: 'none',
            color: '#e55353',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
          }}
        >
          <CIcon icon={cilTrash} size="sm" /> Clear all
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px 10px' }}>
        {history.map((h) => (
          <div
            key={h.id}
            onClick={() => onRecall(h.result)}
            style={{
              borderBottom: '1px solid var(--cui-border-color)',
              padding: '8px 4px',
              cursor: 'pointer',
            }}
            title="Click to recall result"
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--cui-secondary-color)',
                marginBottom: 2,
              }}
            >
              {h.expression} <span style={{ float: 'right' }}>{fmt(h.at)}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cui-body-color)' }}>
              = {h.result}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Calculator tab ────────────────────────────────────────────────────────────

const LAYOUT = [
  [
    { l: 'AC', v: 'clear', variant: 'clear' },
    { l: '+/-', v: 'sign', variant: 'fn' },
    { l: '%', v: 'pct', variant: 'fn' },
    { l: '÷', v: '÷', variant: 'op' },
  ],
  [
    { l: '7', v: '7' },
    { l: '8', v: '8' },
    { l: '9', v: '9' },
    { l: '×', v: '×', variant: 'op' },
  ],
  [
    { l: '4', v: '4' },
    { l: '5', v: '5' },
    { l: '6', v: '6' },
    { l: '−', v: '-', variant: 'op' },
  ],
  [
    { l: '1', v: '1' },
    { l: '2', v: '2' },
    { l: '3', v: '3' },
    { l: '+', v: '+', variant: 'op' },
  ],
  [
    { l: '0', v: '0', span: 2 },
    { l: '.', v: '.' },
    { l: '=', v: '=', variant: 'eq' },
  ],
]

const CalcTab = ({ onResult }) => {
  const [display, setDisplay] = useState('0')
  const [expr, setExpr] = useState('')
  const [fresh, setFresh] = useState(true) // next digit replaces display
  const [error, setError] = useState(false)

  const appendDigit = (d) => {
    setError(false)
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d)
      setFresh(false)
    } else {
      if (d === '.' && display.includes('.')) return
      const next = display === '0' && d !== '.' ? d : display + d
      if (next.replace(/[^0-9]/g, '').length > MAX_DISPLAY) return
      setDisplay(next)
    }
  }

  const appendOp = (op) => {
    setError(false)
    const current = expr + display + ' ' + op + ' '
    setExpr(current)
    setFresh(true)
  }

  const calculate = () => {
    const full = expr + display
    if (!full) return
    try {
      const result = safeEval(full)
      const resultStr = formatResult(result)
      localCalculator.pushEntry(full.trim(), resultStr)
      onResult?.()
      setDisplay(resultStr)
      setExpr('')
      setFresh(true)
    } catch {
      setDisplay('Error')
      setExpr('')
      setFresh(true)
      setError(true)
    }
  }

  const handleBtn = (v) => {
    if (v === 'clear') {
      setDisplay('0')
      setExpr('')
      setFresh(true)
      setError(false)
      return
    }
    if (v === 'sign') {
      if (display === '0' || error) return
      setDisplay((d) => (d.startsWith('-') ? d.slice(1) : '-' + d))
      return
    }
    if (v === 'pct') {
      try {
        const val = parseFloat(display) / 100
        setDisplay(formatResult(val))
        setFresh(true)
      } catch {
        /* ignore */
      }
      return
    }
    if (v === '=') {
      calculate()
      return
    }
    if (['+', '-', '×', '÷'].includes(v)) {
      appendOp(v)
      return
    }
    appendDigit(v)
  }

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const key = e.key
      if (/[0-9]/.test(key)) {
        handleBtn(key)
        return
      }
      if (key === '.') {
        handleBtn('.')
        return
      }
      if (key === '+') {
        handleBtn('+')
        return
      }
      if (key === '-') {
        handleBtn('-')
        return
      }
      if (key === '*') {
        handleBtn('×')
        return
      }
      if (key === '/') {
        e.preventDefault()
        handleBtn('÷')
        return
      }
      if (key === '%') {
        handleBtn('pct')
        return
      }
      if (key === 'Enter' || key === '=') {
        handleBtn('=')
        return
      }
      if (key === 'Backspace') {
        setDisplay((d) => (d.length > 1 && d !== 'Error' ? d.slice(0, -1) : '0'))
        setFresh(false)
        return
      }
      if (key === 'Escape') {
        handleBtn('clear')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div style={{ padding: '0 10px 10px' }}>
      {/* Display */}
      <div
        style={{
          background: 'var(--cui-tertiary-bg)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 10,
          minHeight: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--cui-secondary-color)',
            minHeight: 16,
            wordBreak: 'break-all',
            textAlign: 'right',
          }}
        >
          {expr || ' '}
        </div>
        <div
          style={{
            fontSize: display.length > 10 ? 18 : 26,
            fontWeight: 700,
            color: error ? '#e55353' : 'var(--cui-body-color)',
            wordBreak: 'break-all',
            textAlign: 'right',
            lineHeight: 1.2,
          }}
        >
          {display}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {LAYOUT.flat().map((btn, i) => (
          <CalcBtn
            key={i}
            label={btn.l}
            span={btn.span}
            variant={btn.variant || 'num'}
            onClick={() => handleBtn(btn.v)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Floating Calculator shell ─────────────────────────────────────────────────

const PANEL_W = 280
const PANEL_H = 440

const FloatingCalculator = () => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('calc')
  const [histKey, setHistKey] = useState(0)

  // Position — default bottom-right
  const [pos, setPos] = useState({
    x: window.innerWidth - PANEL_W - 24,
    y: window.innerHeight - PANEL_H - 80,
  })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef(null)

  const onDragStart = useCallback(
    (e) => {
      if (e.button !== 0) return
      dragging.current = true
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
      e.preventDefault()
    },
    [pos],
  )

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const nx = Math.min(
        Math.max(0, e.clientX - dragOffset.current.x),
        window.innerWidth - PANEL_W,
      )
      const ny = Math.min(
        Math.max(0, e.clientY - dragOffset.current.y),
        window.innerHeight - PANEL_H,
      )
      setPos({ x: nx, y: ny })
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Keep in viewport on resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - PANEL_W - 8),
        y: Math.min(p.y, window.innerHeight - PANEL_H - 8),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const tabStyle = (active) => ({
    flex: 1,
    padding: '6px 0',
    background: active ? 'var(--cui-body-bg)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #3279f3' : '2px solid transparent',
    color: active ? '#3279f3' : 'var(--cui-secondary-color)',
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'color 0.15s',
  })

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Calculator"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: open ? '#1f5fd4' : '#3279f3',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 16px rgba(50,121,243,0.45)',
          cursor: 'pointer',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, transform 0.15s',
          transform: open ? 'rotate(45deg) scale(0.9)' : 'scale(1)',
        }}
      >
        <CIcon icon={open ? cilX : cilCalculator} size="lg" />
      </button>

      {/* Calculator panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: PANEL_W,
            height: PANEL_H,
            zIndex: 1049,
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            background: 'var(--cui-body-bg)',
            border: '1px solid var(--cui-border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle / title bar */}
          <div
            onMouseDown={onDragStart}
            style={{
              background: '#3279f3',
              color: '#fff',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <CIcon icon={cilCalculator} />
              Calculator
            </span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                color: '#fff',
                width: 24,
                height: 24,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <CIcon icon={cilX} size="sm" />
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--cui-border-color)',
              background: 'var(--cui-tertiary-bg)',
              flexShrink: 0,
            }}
          >
            <button style={tabStyle(tab === 'calc')} onClick={() => setTab('calc')}>
              Calculator
            </button>
            <button style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>
              History
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
            {tab === 'calc' ? (
              <CalcTab onResult={() => setHistKey((k) => k + 1)} />
            ) : (
              <HistoryTab
                key={histKey}
                onRecall={(val) => {
                  setTab('calc')
                  // Small trick: dispatch a synthetic event — just switch tab and user sees result
                  // The recalled value becomes the next operand visually
                  void val // for now just switch to calc; full recall is in the expr bar
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingCalculator
