/**
 * Shared percentage-redistribution math for BookExpenseModal.jsx — used by
 * both the revenue-source split (RevenueSourceSelector) and the per-project
 * split (project picker), which previously each carried their own
 * near-identical copy of this logic. Both are pure functions over a
 * `{ [key]: pct }` map so every caller keeps its own state shape
 * (pctBySource / projectPctById) and just wraps the result in its own
 * setState call.
 */

/**
 * Splits 100% across `keys` proportional to `weightByKey` (falls back to an
 * even split when every weight is 0 or `weightByKey` is omitted). The first
 * key absorbs whatever rounding remainder is left so the total is always
 * exactly 100 — used when a key is added/removed (toggle) and the whole set
 * needs to be re-split from scratch.
 */
export function splitPercentagesByWeight(keys, weightByKey = {}) {
  if (keys.length === 0) return {}
  const weights = keys.map((k) => weightByKey[k] || 0)
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const pct = {}
  keys.forEach((k, i) => {
    pct[k] =
      totalWeight > 0
        ? Math.round((weights[i] / totalWeight) * 10000) / 100
        : Math.round((100 / keys.length) * 100) / 100
  })
  const sumExceptFirst = keys.slice(1).reduce((s, k) => s + pct[k], 0)
  pct[keys[0]] = Math.round((100 - sumExceptFirst) * 100) / 100
  return pct
}

/**
 * Applies a single edit (`changedKey` -> `changedValue`) and redistributes
 * the remaining percentage proportionally across the other keys' current
 * shares — used while the user is typing into a %/amount field for one
 * already-selected key. The last of the other keys absorbs the rounding
 * remainder so the total stays exactly 100.
 */
export function redistributeOnEdit(keys, changedKey, changedValue, currentPctByKey) {
  const v = Math.max(0, Math.min(100, parseFloat(changedValue) || 0))
  const others = keys.filter((k) => k !== changedKey)
  const remaining = Math.round((100 - v) * 100) / 100
  const othersTotal = others.reduce((s, k) => s + (currentPctByKey[k] || 0), 0)

  const next = { ...currentPctByKey, [changedKey]: v }
  others.forEach((k) => {
    const weight = othersTotal > 0 ? (currentPctByKey[k] || 0) / othersTotal : 1 / others.length
    next[k] = Math.round(remaining * weight * 100) / 100
  })
  if (others.length > 0) {
    const last = others[others.length - 1]
    const sumExceptLast = v + others.slice(0, -1).reduce((s, k) => s + next[k], 0)
    next[last] = Math.round((100 - sumExceptLast) * 100) / 100
  }
  return next
}
