/**
 * Visual Model — dual-mode dashboard
 *
 * Top-level section switcher:
 *   ① HR Dashboard   — headcount KPIs, department breakdown, attendance trend,
 *                       payroll summary, gender split, employment type donut
 *   ② Projects SDP   — Power BI-style projects overview (existing dashboard)
 */

import React, { useState, useRef, useEffect } from 'react'
import { Chart, registerables } from 'chart.js'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { resolveCoords } from '../../../services/sdpProjectsData'
import { localEmployees } from '../../../services/localEmployees'
import { localAttendance } from '../../../services/localAttendance'
import { localProjects } from '../../../services/localProjects'

Chart.register(...registerables)

// ─── Shared helpers ───────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n)

const fmtCompact = (n) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SDP PROJECT DATA (sourced from /docs/Projects sdp .csv) ─────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map a sdpProjectsData record → the display shape expected by charts and map.
 * Fields come directly from the CSV parse; no synthetic or hardcoded values.
 */
const toSdpDisplayShape = (p) => ({
  id: p.id,
  name: p.title || p.name || 'Unknown',
  type: p.project_type || 'Unknown',
  status: p.phase ? p.phase.charAt(0).toUpperCase() + p.phase.slice(1) : 'Ongoing',
  fundingAgency: p.funding_agency || 'Unknown',
  implementingPartner: p.implementing_partner || 'Unknown',
  value: Number(p.project_value) || 0,
  beneficiaries: Number(p.beneficiaries_target) || 0,
  location: resolveCoords(p.location || p.district),
})

const STATUS_COLORS = { Ongoing: '#1e40af', Approved: '#7c3aed', Completed: '#059669' }

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HR DEMO DATA ─────────────────────────────────────════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Live department + gender breakdown from real employee records.
 * Groups Active employees by employment.department (blank → 'Unassigned').
 */
export const buildDepartments = async () => {
  const { items } = await localEmployees.list({ pageSize: 1000 })
  const employees = items.filter((e) => e.status === 'Active')
  const byDept = {}
  for (const e of employees) {
    const dept = e.employment?.department || 'Unassigned'
    if (!byDept[dept]) byDept[dept] = { name: dept, headcount: 0, male: 0, female: 0 }
    byDept[dept].headcount += 1
    if (e.gender === 'Male') byDept[dept].male += 1
    else if (e.gender === 'Female') byDept[dept].female += 1
  }
  return Object.values(byDept).sort((a, b) => b.headcount - a.headcount)
}

/**
 * Live attendance trend for the trailing 6 calendar months (ending this month).
 * A month with no imported attendance data shows 0%, not a fabricated value.
 */
export const buildAttendanceTrend = async () => {
  const today = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    })
  }

  const present = []
  const absent = []
  const leave = []
  const rowsByMonth = await Promise.all(
    months.map((m) => localAttendance.listMonthlySummaries({ year: m.year, month: m.month })),
  )
  for (const rows of rowsByMonth) {
    if (rows.length === 0) {
      present.push(0)
      absent.push(0)
      leave.push(0)
      continue
    }
    let p = 0
    let a = 0
    let l = 0
    for (const r of rows) {
      const total = (r.present_count || 0) + (r.absent_count || 0) + (r.leave_count || 0)
      if (total === 0) continue
      p += (r.present_count || 0) / total
      a += (r.absent_count || 0) / total
      l += (r.leave_count || 0) / total
    }
    present.push(Math.round((p / rows.length) * 100))
    absent.push(Math.round((a / rows.length) * 100))
    leave.push(Math.round((l / rows.length) * 100))
  }

  return { months: months.map((m) => m.label), present, absent, leave }
}

/** Live sum of current_salary across Active employees today (a snapshot, not a trend). */
const computeTotalMonthlyPayroll = async () => {
  const { items } = await localEmployees.list({ pageSize: 1000 })
  return items
    .filter((e) => e.status === 'Active')
    .reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** KPI card (used by both sections) */
const KpiCard = ({ label, value, sub, accent = '#1e40af', icon }) => (
  <div style={{ ...S.kpiCard, borderColor: accent }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ ...S.kpiLabel, color: accent }}>{label}</div>
      {icon && <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>}
    </div>
    <div style={S.kpiValue}>{value}</div>
    {sub && <div style={S.kpiSub}>{sub}</div>}
  </div>
)

/** Card shell used by chart panels */
const ChartCard = ({ title, children, bodyStyle = {} }) => (
  <div style={S.chartCard}>
    <div style={S.chartCardHeader}>{title}</div>
    <div style={{ padding: '10px 12px', ...bodyStyle }}>{children}</div>
  </div>
)

/** Filter checkbox panel */
const FilterPanel = ({ title, items, selected, onToggle, onSelectAll }) => (
  <div style={S.chartCard}>
    <div style={S.chartCardHeader}>{title}</div>
    <div style={{ padding: '8px 12px' }}>
      <div
        style={{
          cursor: 'pointer',
          marginBottom: 6,
          fontSize: 12,
          color: '#1e40af',
          fontWeight: 600,
        }}
        onClick={onSelectAll}
      >
        Select all
      </div>
      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
        {items.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', padding: '3px 0' }}>
            <input
              type="checkbox"
              id={`f-${title}-${item}`}
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
              style={{ marginRight: 6, cursor: 'pointer', accentColor: '#1e40af' }}
            />
            <label
              htmlFor={`f-${title}-${item}`}
              style={{ fontSize: 12, cursor: 'pointer', color: '#374151' }}
            >
              {item.length > 20 ? item.slice(0, 20) + '…' : item}
            </label>
          </div>
        ))}
      </div>
    </div>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CHART COMPONENTS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Re-usable hook to destroy previous chart instance.
 *  Uses requestAnimationFrame to defer canvas init until after layout —
 *  this fixes Firefox rendering charts as black boxes (zero-size canvas). */
const useChart = (ref, builder, deps) => {
  const instance = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    // Defer to next frame so Firefox resolves grid/flex container dimensions first
    const rafId = requestAnimationFrame(() => {
      if (!ref.current) return
      if (instance.current) instance.current.destroy()
      instance.current = builder(ref.current)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (instance.current) {
        instance.current.destroy()
        instance.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Status donut */
const StatusDonut = ({ data }) => {
  const ref = useRef(null)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [
            {
              data: Object.values(data),
              backgroundColor: Object.keys(data).map((l) => STATUS_COLORS[l] || '#6b7280'),
              borderWidth: 2,
              borderColor: '#fff',
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
            tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}` } },
          },
        },
      }),
    [JSON.stringify(data)],
  )
  return <canvas ref={ref} height={160} style={{ width: '100%' }} />
}

/** Horizontal bar – project value */
const ValueBar = ({ data }) => {
  const ref = useRef(null)
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 12)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: sorted.map((p) => (p.name.length > 28 ? p.name.slice(0, 28) + '…' : p.name)),
          datasets: [
            {
              data: sorted.map((p) => p.value),
              backgroundColor: '#3b82f6',
              borderRadius: 3,
              barThickness: 14,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => ` ₹${fmt(c.parsed.x)}` } },
          },
          scales: {
            x: {
              grid: { color: '#f1f5f9' },
              ticks: { font: { size: 10 }, callback: (v) => fmtCompact(v) },
            },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        },
      }),
    [sorted.map((p) => p.id).join()],
  )
  return <canvas ref={ref} style={{ width: '100%' }} />
}

/** Vertical bar – funding agency */
const FundingBar = ({ data }) => {
  const ref = useRef(null)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(data),
          datasets: [
            {
              label: 'Projects',
              data: Object.values(data),
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              barThickness: 28,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (c) => ` ${c.parsed.y} project${c.parsed.y !== 1 ? 's' : ''}` },
            },
          },
          scales: {
            y: {
              grid: { color: '#f1f5f9' },
              ticks: { stepSize: 1, font: { size: 11 } },
              title: { display: true, text: 'Count', font: { size: 11 }, color: '#6b7280' },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 30 },
              title: {
                display: true,
                text: 'Funding Agency',
                font: { size: 11 },
                color: '#6b7280',
              },
            },
          },
        },
      }),
    [JSON.stringify(data)],
  )
  return <canvas ref={ref} height={180} style={{ width: '100%' }} />
}

/** Real Leaflet map */
const IndiaMap = ({ projects }) => {
  const popupStyle = { fontSize: 12, lineHeight: 1.5, minWidth: 160 }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <MapContainer
        center={[22.5, 80.5]}
        zoom={4}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {projects.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.location.lat, p.location.lng]}
            radius={10}
            pathOptions={{
              fillColor: STATUS_COLORS[p.status] || '#3b82f6',
              fillOpacity: 0.88,
              color: '#fff',
              weight: 2,
            }}
          >
            <Popup>
              <div style={popupStyle}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: '#1e40af' }}>
                  {p.location.label}
                </div>
                <div style={{ marginBottom: 2 }}>{p.name}</div>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      background: STATUS_COLORS[p.status],
                      color: '#fff',
                      borderRadius: 10,
                      padding: '1px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <div style={{ marginTop: 4, color: '#64748b', fontSize: 11 }}>
                  <div>Funding: {p.fundingAgency}</div>
                  <div>Value: ₹{p.value.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 8,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 11,
          zIndex: 1000,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: c,
                border: '1.5px solid #fff',
              }}
            />
            <span style={{ fontWeight: 500 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HR CHART COMPONENTS ──────────────────────────────────────────────────────

/** Grouped bar – department headcount by gender */
const DeptBar = ({ departments }) => {
  const ref = useRef(null)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: departments.map((d) => d.name),
          datasets: [
            {
              label: 'Male',
              data: departments.map((d) => d.male),
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              barThickness: 16,
            },
            {
              label: 'Female',
              data: departments.map((d) => d.female),
              backgroundColor: '#ec4899',
              borderRadius: 4,
              barThickness: 16,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 25 } },
            y: {
              grid: { color: '#f1f5f9' },
              ticks: { stepSize: 5, font: { size: 11 } },
              title: { display: true, text: 'Headcount', font: { size: 11 }, color: '#6b7280' },
            },
          },
        },
      }),
    [departments.map((d) => d.name).join()],
  )
  return <canvas ref={ref} height={200} style={{ width: '100%' }} />
}

/** Stacked area line – attendance trend */
const AttendanceTrend = ({ months, present, absent, leave }) => {
  const ref = useRef(null)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Present %',
              data: present,
              borderColor: '#059669',
              backgroundColor: 'rgba(5,150,105,0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              borderWidth: 2,
            },
            {
              label: 'Absent %',
              data: absent,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              borderWidth: 2,
            },
            {
              label: 'On Leave %',
              data: leave,
              borderColor: '#d97706',
              backgroundColor: 'rgba(217,119,6,0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: {
            y: {
              grid: { color: '#f1f5f9' },
              ticks: { callback: (v) => v + '%', font: { size: 11 } },
              min: 0,
              max: 100,
            },
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          },
        },
      }),
    [months.join(), present.join(), absent.join(), leave.join()],
  )
  return <canvas ref={ref} height={180} style={{ width: '100%' }} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── STYLES ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const S = {
  page: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    background: '#f0f4f8',
    minHeight: '100vh',
    padding: '0 0 40px',
  },

  /* ── Section switcher ── */
  switcherWrap: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  switcherLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  switcherBtn: (active, color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 20px',
    borderRadius: 8,
    border: `2px solid ${active ? color : '#e2e8f0'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#374151',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: active ? `0 4px 14px ${color}55` : 'none',
    transition: 'all 0.2s',
  }),

  /* ── Shared card atoms ── */
  kpiCard: {
    background: '#fff',
    border: '2px solid #1e40af',
    borderRadius: 8,
    padding: '12px 14px',
    minWidth: 0,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  kpiSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
  chartCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  chartCardHeader: {
    background: '#1e40af',
    color: '#fff',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  /* ── Page header ── */
  header: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)',
    color: '#fff',
    padding: '18px 28px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 12px rgba(30,64,175,0.25)',
  },
  headerTitle: { fontSize: 22, fontWeight: 700, letterSpacing: 0.5, margin: 0 },

  /* ── PBI sub-tabs ── */
  tabBar: {
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    display: 'flex',
    padding: '0 20px',
  },
  tab: (active) => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? '#1e40af' : '#64748b',
    borderBottom: active ? '3px solid #1e40af' : '3px solid transparent',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    outline: 'none',
    transition: 'color 0.15s',
  }),

  /* ── Layout grids ── */
  body: { padding: '16px 20px' },
  kpiRow6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 },
  kpiRow4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 1fr 1fr',
    gap: 12,
    marginBottom: 12,
  },
  bottomGrid: { display: 'grid', gridTemplateColumns: '200px 200px 1fr', gap: 12 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  threeCol: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HR DASHBOARD SECTION ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const HRDashboard = () => {
  const [departments, setDepartments] = useState([])
  const [totalMonthlyPayroll, setTotalMonthlyPayroll] = useState(0)
  const [attendance, setAttendance] = useState({ months: [], present: [], absent: [], leave: [] })

  useEffect(() => {
    let cancelled = false
    buildDepartments().then((depts) => {
      if (!cancelled) setDepartments(depts)
    })
    computeTotalMonthlyPayroll().then((total) => {
      if (!cancelled) setTotalMonthlyPayroll(total)
    })

    const handleAttendanceChange = () => {
      buildAttendanceTrend().then((trend) => {
        if (!cancelled) setAttendance(trend)
      })
    }
    handleAttendanceChange()

    window.addEventListener('hma_attendance_changed', handleAttendanceChange)
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('hma_attendance_')) {
        handleAttendanceChange()
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('hma_attendance_changed', handleAttendanceChange)
    }
  }, [])

  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)
  const avgAttendance = Math.round(
    attendance.present.reduce((s, v) => s + v, 0) / Math.max(1, attendance.present.length),
  )

  return (
    <>
      {/* KPI row */}
      <div style={S.kpiRow4}>
        <KpiCard label="Total Employees" value={totalHeadcount} icon="👥" accent="#1e40af" />
        <KpiCard label="Avg Attendance" value={`${avgAttendance}%`} icon="📅" accent="#059669" />
        <KpiCard
          label="Monthly Payroll"
          value={`₹${fmtCompact(totalMonthlyPayroll)}`}
          sub={`₹${fmt(totalMonthlyPayroll)} · current snapshot`}
          icon="💰"
          accent="#6366f1"
        />
        <KpiCard
          label="Gender Split"
          value={`${totalMale}M / ${totalFemale}F`}
          icon="⚖️"
          accent="#0891b2"
        />
      </div>

      {/* Row 1: Dept bar + Attendance trend */}
      <div style={S.twoCol}>
        <ChartCard title="Headcount by Department & Gender">
          <DeptBar departments={departments} />
        </ChartCard>
        <ChartCard title="Attendance Trend (%) — Last 6 Months">
          <AttendanceTrend
            months={attendance.months}
            present={attendance.present}
            absent={attendance.absent}
            leave={attendance.leave}
          />
        </ChartCard>
      </div>

      {/* Row 3: Department detail table */}
      <ChartCard title="Department Summary">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Department', 'Total', 'Male', 'Female', 'Gender Ratio', 'Share'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: '#374151',
                      borderBottom: '2px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => {
                const pct = Math.round((d.headcount / totalHeadcount) * 100)
                return (
                  <tr key={d.name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e40af' }}>
                      {d.name}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{d.headcount}</td>
                    <td style={{ padding: '8px 12px', color: '#3b82f6' }}>{d.male}</td>
                    <td style={{ padding: '8px 12px', color: '#ec4899' }}>{d.female}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>
                      {d.male}:{d.female}
                    </td>
                    <td style={{ padding: '8px 12px', minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: '#1e40af',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e40af', color: '#fff' }}>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{totalHeadcount}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{totalMale}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{totalFemale}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                  {totalMale}:{totalFemale}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PROJECTS SDP SECTION ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const SDP_TABS = ['Overview', 'Milestone', 'Finance', 'LSGB']

const ProjectsSDP = () => {
  const [activeTab, setActiveTab] = useState('Overview')
  const [allProjects, setAllProjects] = useState([])
  const [SDP_TYPES, setSdpTypes] = useState([])
  const [SDP_FUNDING_AGENCIES, setSdpFundingAgencies] = useState([])
  const [SDP_PARTNERS, setSdpPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedTypes, setSelectedTypes] = useState(null) // null = all selected
  const [selectedFunding, setSelectedFunding] = useState(null)
  const [selectedPartners, setSelectedPartners] = useState(null)

  useEffect(() => {
    let active = true
    localProjects
      .list({ pageSize: 1000 })
      .then(({ items }) => {
        if (!active) return
        const mapped = items.map(toSdpDisplayShape)
        setAllProjects(mapped)
        setSdpTypes([...new Set(mapped.map((p) => p.type))].filter(Boolean))
        setSdpFundingAgencies([...new Set(mapped.map((p) => p.fundingAgency))].filter(Boolean))
        setSdpPartners([...new Set(mapped.map((p) => p.implementingPartner))].filter(Boolean))
        setLoadError('')
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setLoadError(err?.message || 'Failed to load projects.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // null means "all" — fall back to full list
  const effectiveTypes = selectedTypes ?? SDP_TYPES
  const effectiveFunding = selectedFunding ?? SDP_FUNDING_AGENCIES
  const effectivePartners = selectedPartners ?? SDP_PARTNERS

  const toggle = (current, setCurrent, allItems, item) => {
    const base = current ?? allItems
    setCurrent(base.includes(item) ? base.filter((x) => x !== item) : [...base, item])
  }

  const filtered = allProjects.filter(
    (p) =>
      effectiveTypes.includes(p.type) &&
      effectiveFunding.includes(p.fundingAgency) &&
      effectivePartners.includes(p.implementingPartner),
  )

  const totalProjects = filtered.length
  const totalValue = filtered.reduce((s, p) => s + p.value, 0)
  const totalBeneficiaries = filtered.reduce((s, p) => s + p.beneficiaries, 0)
  const completed = filtered.filter((p) => p.status === 'Completed').length
  const ongoing = filtered.filter((p) => p.status === 'Ongoing').length
  const approved = filtered.filter((p) => p.status === 'Approved').length

  const statusData = { Ongoing: ongoing, Approved: approved, Completed: completed }

  const fundingCount = {}
  filtered.forEach((p) => {
    fundingCount[p.fundingAgency] = (fundingCount[p.fundingAgency] || 0) + 1
  })

  return (
    <>
      {/* PBI sub-tabs + live badge */}
      <div style={{ ...S.tabBar, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex' }}>
          {SDP_TABS.map((tab) => (
            <button key={tab} style={S.tab(tab === activeTab)} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingRight: 16,
            fontSize: 11,
            color: loadError ? '#dc2626' : '#059669',
            fontWeight: 700,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: loadError ? '#dc2626' : '#059669',
              boxShadow: loadError ? 'none' : '0 0 0 0 rgba(5,150,105,0.4)',
              animation: loadError ? 'none' : 'sdp-pulse 1.8s infinite',
            }}
          />
          {loadError ? 'DB ERROR' : 'LIVE DB'}
          <style>{`@keyframes sdp-pulse { 0%{box-shadow:0 0 0 0 rgba(5,150,105,0.4)} 70%{box-shadow:0 0 0 6px rgba(5,150,105,0)} 100%{box-shadow:0 0 0 0 rgba(5,150,105,0)} }`}</style>
        </div>
      </div>

      <div style={S.body}>
        {loadError ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#dc2626' }}>
            Failed to load projects: {loadError}
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            Loading live projects...
          </div>
        ) : activeTab === 'Overview' ? (
          <>
            {/* KPI row */}
            <div style={S.kpiRow6}>
              <KpiCard label="Total Projects" value={totalProjects} />
              <KpiCard
                label="Total Project Value"
                value={`₹${fmtCompact(totalValue)}`}
                sub={`₹${fmt(totalValue)}`}
              />
              <KpiCard
                label="Total Beneficiaries"
                value={totalBeneficiaries.toLocaleString('en-IN')}
              />
              <KpiCard label="Completed Projects" value={completed} />
              <KpiCard label="Ongoing Projects" value={ongoing} />
              <KpiCard label="Approved Projects" value={approved} />
            </div>

            {/* Main grid */}
            <div style={S.mainGrid}>
              <FilterPanel
                title="Project Type"
                items={SDP_TYPES}
                selected={effectiveTypes}
                onToggle={(i) => toggle(selectedTypes, setSelectedTypes, SDP_TYPES, i)}
                onSelectAll={() => setSelectedTypes(null)}
              />
              <ChartCard
                title="Project by Status"
                bodyStyle={{ minHeight: 200, display: 'flex', alignItems: 'center' }}
              >
                <StatusDonut key={JSON.stringify(statusData)} data={statusData} />
              </ChartCard>
              <div style={S.chartCard}>
                <div style={S.chartCardHeader}>Project Location</div>
                <div style={{ padding: 0, height: 260 }}>
                  <IndiaMap projects={filtered} />
                </div>
              </div>
              <ChartCard title="Project by Value" bodyStyle={{ overflowY: 'auto', maxHeight: 240 }}>
                <ValueBar key={filtered.map((p) => p.id).join()} data={filtered} />
              </ChartCard>
            </div>

            {/* Bottom grid */}
            <div style={S.bottomGrid}>
              <FilterPanel
                title="Funding Agency"
                items={SDP_FUNDING_AGENCIES}
                selected={effectiveFunding}
                onToggle={(i) =>
                  toggle(selectedFunding, setSelectedFunding, SDP_FUNDING_AGENCIES, i)
                }
                onSelectAll={() => setSelectedFunding(null)}
              />
              <FilterPanel
                title="Implementing Partner"
                items={SDP_PARTNERS}
                selected={effectivePartners}
                onToggle={(i) => toggle(selectedPartners, setSelectedPartners, SDP_PARTNERS, i)}
                onSelectAll={() => setSelectedPartners(null)}
              />
              <ChartCard title="Project by Funding Agency">
                <FundingBar key={JSON.stringify(fundingCount)} data={fundingCount} />
              </ChartCard>
            </div>
          </>
        ) : (
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 48,
              textAlign: 'center',
              border: '2px dashed #e2e8f0',
              marginTop: 16,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>{activeTab} View</div>
            <div style={{ fontSize: 13, marginTop: 4, color: '#94a3b8' }}>
              This section is under development.
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ROOT PAGE COMPONENT ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  {
    id: 'hr',
    label: 'HR Dashboard',
    icon: '👥',
    color: '#1e40af',
    sub: 'People & Payroll Analytics',
  },
  { id: 'sdp', label: 'Projects SDP', icon: '📊', color: '#7c3aed', sub: 'SDP Projects Overview' },
]

const VisualModelPage = () => {
  const [section, setSection] = useState('hr')

  const active = SECTIONS.find((s) => s.id === section)

  return (
    <div style={S.page}>
      {/* Page header */}
      <div
        style={{
          ...S.header,
          background: `linear-gradient(135deg, ${active.color}ee 0%, ${active.color} 100%)`,
        }}
      >
        <div>
          <h1 style={S.headerTitle}>
            {active.icon} {active.sub}
          </h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            Visual Model · HMA IEMS
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            LIVE
          </div>
        </div>
      </div>

      {/* ── Section Switcher ── */}
      <div style={S.switcherWrap}>
        <span style={S.switcherLabel}>View:</span>
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSection(sec.id)}
            style={S.switcherBtn(section === sec.id, sec.color)}
          >
            <span style={{ fontSize: 16 }}>{sec.icon}</span>
            {sec.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
          Switch between HR analytics and project intelligence reports
        </div>
      </div>

      {/* ── Section Content ── */}
      {section === 'hr' ? (
        <div style={S.body}>
          <HRDashboard />
        </div>
      ) : (
        <ProjectsSDP />
      )}
    </div>
  )
}

export default VisualModelPage
