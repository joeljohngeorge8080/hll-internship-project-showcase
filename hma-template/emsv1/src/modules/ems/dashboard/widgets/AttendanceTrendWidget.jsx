import React, { useEffect, useRef, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import { Chart, registerables } from 'chart.js'
import { buildAttendanceTrend } from '../../reports-analysis/VisualModelPage'

Chart.register(...registerables)

const AttendanceTrendWidget = () => {
  const [trend, setTrend] = useState(null)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    buildAttendanceTrend().then((data) => {
      if (!cancelled) setTrend(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!trend || !canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: trend.months,
        datasets: [
          {
            label: 'Present %',
            data: trend.present,
            borderColor: '#059669',
            backgroundColor: 'rgba(5,150,105,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'Absent %',
            data: trend.absent,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'On Leave %',
            data: trend.leave,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217,119,6,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          y: { ticks: { callback: (v) => v + '%', font: { size: 10 } }, min: 0, max: 100 },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [trend])

  return (
    <CCard className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
      <CCardBody className="pt-4">
        <h6 className="fw-semibold mb-3 small text-uppercase text-body-secondary">
          Attendance Trend
        </h6>
        <div style={{ height: 180 }}>
          <canvas ref={canvasRef} />
        </div>
      </CCardBody>
    </CCard>
  )
}

export default AttendanceTrendWidget
