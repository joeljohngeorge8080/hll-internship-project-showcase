/**
 * DomeGallery — auto-rotating, non-interactive photo dome used as the login
 * page background. Adapted from the react-bits DomeGallery component with the
 * drag/click-to-enlarge interaction stripped out (background decoration only).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import './DomeGallery.css'

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const wrapAngleSigned = (deg) => {
  const a = (((deg + 180) % 360) + 360) % 360
  return a - 180
}

function buildItems(pool, seg) {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2)
  const evenYs = [-4, -2, 0, 2, 4]
  const oddYs = [-3, -1, 1, 3, 5]

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs
    return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }))
  })

  const totalSlots = coords.length
  if (pool.length === 0) return coords.map((c) => ({ ...c, src: '', alt: '' }))

  const normalizedImages = pool.map((image) =>
    typeof image === 'string'
      ? { src: image, alt: '' }
      : { src: image.src || '', alt: image.alt || '' },
  )
  const usedImages = Array.from(
    { length: totalSlots },
    (_, i) => normalizedImages[i % normalizedImages.length],
  )

  for (let i = 1; i < usedImages.length; i++) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j++) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i]
          usedImages[i] = usedImages[j]
          usedImages[j] = tmp
          break
        }
      }
    }
  }

  return coords.map((c, i) => ({ ...c, src: usedImages[i].src, alt: usedImages[i].alt }))
}

export default function DomeGallery({
  images = [],
  fit = 0.9,
  fitBasis = 'auto',
  minRadius = 300,
  maxRadius = Infinity,
  padFactor = 0.25,
  overlayBlurColor = '#120F17',
  tiltDeg = 3,
  segments = 24,
  autoRotateSpeed = 3, // degrees per second
  grayscale = false,
  imageBorderRadius = '20px',
  pushBack = 0, // extra distance (px) to move the whole sphere away from the
  // viewer, on top of --radius — reduces the up-close fisheye distortion so
  // the tiles read as a gently curved globe instead of a warped wall
}) {
  const rootRef = useRef(null)
  const sphereRef = useRef(null)
  const rotationYRef = useRef(0)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)

  const items = useMemo(() => buildItems(images, segments), [images, segments])

  const applyTransform = useCallback(
    (yDeg) => {
      const el = sphereRef.current
      if (el) {
        el.style.transform = `translateZ(calc((var(--radius) + var(--push-back, 0px)) * -1)) rotateX(${tiltDeg}deg) rotateY(${yDeg}deg)`
      }
    },
    [tiltDeg],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      const w = Math.max(1, cr.width)
      const h = Math.max(1, cr.height)
      const minDim = Math.min(w, h)
      const maxDim = Math.max(w, h)
      const aspect = w / h
      let basis
      switch (fitBasis) {
        case 'min':
          basis = minDim
          break
        case 'max':
          basis = maxDim
          break
        case 'width':
          basis = w
          break
        case 'height':
          basis = h
          break
        default:
          basis = aspect >= 1.3 ? w : minDim
      }
      let radius = basis * fit
      radius = Math.min(radius, h * 1.35)
      radius = clamp(radius, minRadius, maxRadius)

      const viewerPad = Math.max(8, Math.round(minDim * padFactor))
      root.style.setProperty('--radius', `${Math.round(radius)}px`)
      root.style.setProperty('--viewer-pad', `${viewerPad}px`)
      root.style.setProperty('--overlay-blur-color', overlayBlurColor)
      root.style.setProperty('--tile-radius', imageBorderRadius)
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none')
      applyTransform(rotationYRef.current)
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [
    fit,
    fitBasis,
    minRadius,
    maxRadius,
    padFactor,
    overlayBlurColor,
    grayscale,
    imageBorderRadius,
    applyTransform,
  ])

  // Auto-rotate — the only motion this gallery has; no drag/click handling by design
  useEffect(() => {
    if (!autoRotateSpeed) return undefined
    const step = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      rotationYRef.current = wrapAngleSigned(rotationYRef.current + autoRotateSpeed * dt)
      applyTransform(rotationYRef.current)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [autoRotateSpeed, applyTransform])

  return (
    <div
      ref={rootRef}
      className="dome-gallery-root"
      style={{
        ['--segments-x']: segments,
        ['--segments-y']: segments,
        ['--overlay-blur-color']: overlayBlurColor,
        ['--tile-radius']: imageBorderRadius,
        ['--image-filter']: grayscale ? 'grayscale(1)' : 'none',
        ['--push-back']: `${pushBack}px`,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <main className="dome-gallery-main">
        <div className="dome-gallery-stage">
          <div ref={sphereRef} className="dome-gallery-sphere">
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className="dome-gallery-item"
                style={{
                  ['--offset-x']: it.x,
                  ['--offset-y']: it.y,
                  ['--item-size-x']: it.sizeX,
                  ['--item-size-y']: it.sizeY,
                }}
              >
                <div className="dome-gallery-item__image">
                  <img src={it.src} draggable={false} alt="" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dome-gallery-overlay" />
        <div className="dome-gallery-overlay dome-gallery-overlay--blur" />
        <div className="dome-gallery-edge-fade dome-gallery-edge-fade--top" />
        <div className="dome-gallery-edge-fade dome-gallery-edge-fade--bottom" />
      </main>
    </div>
  )
}
