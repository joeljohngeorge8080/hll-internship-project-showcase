import React from 'react'

// Generates a gear SVG path centred at (cx, cy).
// outerR = tip radius, innerR = root radius, holeR = centre hole radius, n = tooth count.
const gearPath = (cx, cy, outerR, innerR, holeR, n) => {
  const pts = []
  const pitch = (Math.PI * 2) / n
  const tw = pitch * 0.33 // angular half-width of each tooth

  for (let i = 0; i < n; i++) {
    const a = i * pitch - Math.PI / 2

    const angles = [a - tw, a - tw * 0.38, a + tw * 0.38, a + tw]
    const radii = [innerR, outerR, outerR, innerR]
    const points = angles.map((angle, j) => [
      (cx + radii[j] * Math.cos(angle)).toFixed(1),
      (cy + radii[j] * Math.sin(angle)).toFixed(1),
    ])

    if (i === 0) pts.push(`M ${points[0][0]},${points[0][1]}`)
    else pts.push(`A ${innerR},${innerR} 0 0,1 ${points[0][0]},${points[0][1]}`)

    pts.push(
      `L ${points[1][0]},${points[1][1]}`,
      `L ${points[2][0]},${points[2][1]}`,
      `L ${points[3][0]},${points[3][1]}`,
    )
  }

  pts.push('Z')

  // Centre hole drawn counter-clockwise so fill-rule:evenodd punches it out
  const hx = (cx + holeR).toFixed(1)
  const hxn = (cx - holeR).toFixed(1)
  pts.push(
    `M ${hx},${cy}`,
    `A ${holeR},${holeR} 0 1,0 ${hxn},${cy}`,
    `A ${holeR},${holeR} 0 1,0 ${hx},${cy}`,
    'Z',
  )

  return pts.join(' ')
}

const MaintenancePage = ({ message }) => (
  <div className="hma-maintenance__bg" role="alert" aria-live="assertive">
    {/* Pulsing depth rings */}
    <div className="hma-maintenance__ring hma-maintenance__ring--1" aria-hidden="true" />
    <div className="hma-maintenance__ring hma-maintenance__ring--2" aria-hidden="true" />
    <div className="hma-maintenance__ring hma-maintenance__ring--3" aria-hidden="true" />

    <div className="hma-maintenance__card">
      {/* Brand eyebrow */}
      <div className="hma-maintenance__brand">HMA IEMS</div>

      {/* Animated gears */}
      <div className="hma-maintenance__gears" aria-hidden="true">
        {/*
          Large gear:  centre (60, 58), outerR 38, innerR 26, holeR 10, 10 teeth
          Small gear:  centre (122,63), outerR 25, innerR 17, holeR  7,  7 teeth
          Center distance ≈ 63 ≈ 38 + 25  → teeth mesh visually
          Speed ratio 7:4.9 ≈ 10/7 (correct for tooth counts)
        */}
        <svg viewBox="0 0 182 120" width="182" height="120" xmlns="http://www.w3.org/2000/svg">
          {/* Large gear — clockwise */}
          <g transform="translate(60,58)">
            <g className="hma-maintenance__gear-cw">
              <path d={gearPath(0, 0, 38, 26, 10, 10)} fill="#1d4ed8" fillRule="evenodd" />
              {/* Spoke details */}
              {[0, 72, 144, 216, 288].map((deg) => {
                const r = (deg * Math.PI) / 180
                return (
                  <line
                    key={deg}
                    x1={(7 * Math.cos(r)).toFixed(1)}
                    y1={(7 * Math.sin(r)).toFixed(1)}
                    x2={(18 * Math.cos(r)).toFixed(1)}
                    y2={(18 * Math.sin(r)).toFixed(1)}
                    stroke="rgba(147,197,253,0.25)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )
              })}
              <circle r="5" fill="#3b82f6" />
              <circle r="2" fill="rgba(147,197,253,0.6)" />
            </g>
          </g>

          {/* Small gear — counter-clockwise */}
          <g transform="translate(122,63)">
            <g className="hma-maintenance__gear-ccw">
              <path d={gearPath(0, 0, 25, 17, 7, 7)} fill="#1e3a8a" fillRule="evenodd" />
              {[0, 120, 240].map((deg) => {
                const r = (deg * Math.PI) / 180
                return (
                  <line
                    key={deg}
                    x1={(5 * Math.cos(r)).toFixed(1)}
                    y1={(5 * Math.sin(r)).toFixed(1)}
                    x2={(12 * Math.cos(r)).toFixed(1)}
                    y2={(12 * Math.sin(r)).toFixed(1)}
                    stroke="rgba(147,197,253,0.2)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )
              })}
              <circle r="3.5" fill="#2563eb" />
              <circle r="1.5" fill="rgba(147,197,253,0.5)" />
            </g>
          </g>

          {/* Subtle connection line at mesh point */}
          <circle cx="97" cy="61" r="2.5" fill="rgba(59,130,246,0.18)" />
        </svg>
      </div>

      <h2 className="hma-maintenance__title">System Under Maintenance</h2>
      <p className="hma-maintenance__subtitle">
        HMA IEMS is currently undergoing scheduled maintenance.
        <br />
        We&rsquo;ll be back shortly — thank you for your patience.
      </p>

      {message && <div className="hma-maintenance__message">{message}</div>}

      {/* Animated loading dots */}
      <div className="hma-maintenance__dots" aria-label="Please wait">
        <div className="hma-maintenance__dot" />
        <div className="hma-maintenance__dot" />
        <div className="hma-maintenance__dot" />
      </div>

      <div className="hma-maintenance__label">HMA Internal Enterprise Management System</div>
    </div>
  </div>
)

export default MaintenancePage
