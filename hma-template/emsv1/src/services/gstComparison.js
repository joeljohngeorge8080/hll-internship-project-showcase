// Pure comparison logic for the GSTR-2B vs. our-own-report reconciliation.
// Matches purely on GSTIN + Invoice Number, normalized to absorb common
// formatting differences between a government portal export and a
// manually-prepared sheet (whitespace, dashes/slashes/dots/underscores,
// case). Digits are left untouched — a GSTIN's state-code digits (e.g. a
// Delhi GSTIN starting "07") are significant, so leading zeros are never
// stripped.

const normalize = (v) =>
  String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-/._,]/g, '')

const keyOf = (gstin, invoiceNumber) => `${normalize(gstin)}|${normalize(invoiceNumber)}`

// Rupees of tolerance on the total-value comparison — absorbs paisa-level
// rounding differences between the government sheet and a manually
// prepared one without masking a genuine mismatch.
const AMOUNT_TOLERANCE = 1

// GSTIN + invoice number match, then classify by amount:
//   'matched' — same key, total value equal within tolerance
//   'partial' — same key, but total value differs (partial match)
//   'missing' — key not found in the other sheet at all
const classify = (ownAmount, gstr2bAmount) => {
  const diff = Math.round(((Number(ownAmount) || 0) - (Number(gstr2bAmount) || 0)) * 100) / 100
  return Math.abs(diff) <= AMOUNT_TOLERANCE
    ? { status: 'matched', amountDiff: 0 }
    : { status: 'partial', amountDiff: diff }
}

// entries: [{ gstin, invoiceNumber, ... }] from either parser (field names
// differ slightly — gstr2b uses `gstin`/`invoiceValue`, our report uses
// `gstNo`/`totalValue` — so the caller passes an accessor pair rather than
// hardcoding field names here).
export const compareGstSheets = (gstr2bEntries, ownEntries) => {
  const ownByKey = new Map()
  ownEntries.forEach((e) => ownByKey.set(keyOf(e.gstNo, e.invoiceNumber), e))

  const gstr2bByKey = new Map()
  gstr2bEntries.forEach((e) => gstr2bByKey.set(keyOf(e.gstin, e.invoiceNumber), e))

  const gstr2bRows = gstr2bEntries.map((e) => {
    const counterpart = ownByKey.get(keyOf(e.gstin, e.invoiceNumber))
    if (!counterpart) {
      return { ...e, matched: false, status: 'missing', amountDiff: null, counterpartValue: null }
    }
    const { status, amountDiff } = classify(counterpart.totalValue, e.invoiceValue)
    return { ...e, matched: true, status, amountDiff, counterpartValue: counterpart.totalValue }
  })
  const ownRows = ownEntries.map((e) => {
    const counterpart = gstr2bByKey.get(keyOf(e.gstNo, e.invoiceNumber))
    if (!counterpart) {
      return { ...e, matched: false, status: 'missing', amountDiff: null, counterpartValue: null }
    }
    const { status, amountDiff } = classify(e.totalValue, counterpart.invoiceValue)
    return { ...e, matched: true, status, amountDiff, counterpartValue: counterpart.invoiceValue }
  })

  const countBy = (rows, status) => rows.filter((r) => r.status === status).length

  return {
    gstr2bRows,
    ownRows,
    summary: {
      gstr2bCount: gstr2bRows.length,
      ownCount: ownRows.length,
      matchedCount: countBy(ownRows, 'matched'),
      partialCount: countBy(ownRows, 'partial'),
      onlyInGstr2bCount: countBy(gstr2bRows, 'missing'),
      onlyInOwnCount: countBy(ownRows, 'missing'),
    },
  }
}
