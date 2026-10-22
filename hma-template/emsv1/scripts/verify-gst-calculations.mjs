import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

const { gstinChecksumChar, validateGstin, stateFromGstin, computeGstFields, round2 } =
  await loadEsmSource('src/services/gstCalculations.js')

// ── GSTIN validation ────────────────────────────────────────────────
// Known-valid public example GSTIN (Maharashtra). If this fails but the
// self-constructed ones below pass, the checksum factor order is wrong.
assert.equal(validateGstin('27AAPFU0939F1ZV'), true, 'known valid GSTIN must validate')
assert.equal(validateGstin(' 27aapfu0939f1zv '), true, 'trim + uppercase tolerated')
assert.equal(validateGstin('27AAPFU0939F1ZZ'), false, 'tampered check digit fails')
assert.equal(validateGstin('27AAPFU0939F1Z'), false, 'wrong length fails')
assert.equal(validateGstin(''), false)
assert.equal(validateGstin(null), false)
assert.equal(validateGstin('XXAAPFU0939F1ZV'), false, 'non-numeric state code fails')

// unknown state code fails even with a correct checksum
const bad14 = '00AAPFU0939F1Z'
assert.equal(validateGstin(bad14 + gstinChecksumChar(bad14)), false)

// construct a valid Kerala GSTIN from the checksum helper
const kerala14 = '32AAPFU0939F1Z'
const KERALA_GSTIN = kerala14 + gstinChecksumChar(kerala14)
assert.equal(validateGstin(KERALA_GSTIN), true)
assert.equal(stateFromGstin(KERALA_GSTIN), 'Kerala')
assert.equal(stateFromGstin('27AAPFU0939F1ZV'), 'Maharashtra')
assert.equal(stateFromGstin('junk'), null)

// ── round2 ──────────────────────────────────────────────────────────
assert.equal(round2(1.005), 1.01)
assert.equal(round2(84.745762), 84.75)

// ── computeGstFields ────────────────────────────────────────────────
// intra-state: 118 total @ 18% → taxable 100, CGST 9, SGST 9, IGST 0
let c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual(
  [c.gstinValid, c.state, c.taxableValue, c.gstAmount, c.cgst, c.sgst, c.igst, c.cessAmount],
  [true, 'Kerala', 100, 18, 9, 9, 0, 0],
)

// inter-state: same numbers → IGST gets the full GST amount
c = computeGstFields({ gstNo: '27AAPFU0939F1ZV', totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual([c.state, c.taxableValue, c.cgst, c.sgst, c.igst], ['Maharashtra', 100, 0, 0, 18])

// cess: 106 total @ 5% GST + 1% cess → taxable 100, CGST 2.5, SGST 2.5, cess 1
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 106, gstRate: 5, cessRate: 1 })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [100, 2.5, 2.5, 0, 1])

// zero rate: whole amount taxable, zero tax
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 500, gstRate: 0, cessRate: 0 })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [500, 0, 0, 0, 0])

// invalid GSTIN: split is unknowable; taxable/gst/cess still computed
c = computeGstFields({ gstNo: 'BADGST', totalValue: 118, gstRate: 18, cessRate: 0 })
assert.deepEqual(
  [c.gstinValid, c.state, c.cgst, c.sgst, c.igst, c.taxableValue, c.gstAmount],
  [false, null, null, null, null, 100, 18],
)

// numeric-garbage inputs degrade to 0, never NaN
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 'abc', gstRate: undefined, cessRate: null })
assert.deepEqual([c.taxableValue, c.cgst, c.sgst, c.igst, c.cessAmount], [0, 0, 0, 0, 0])

// rounding never produces NaN and halves differ by < 1 paisa
c = computeGstFields({ gstNo: KERALA_GSTIN, totalValue: 100, gstRate: 18, cessRate: 0 })
assert.equal(c.cgst, c.sgst)
assert.ok(Math.abs(c.cgst + c.sgst - c.gstAmount) <= 0.01, 'split reconstructs GST amount within 1 paisa')

console.log('verify-gst-calculations: ALL PASS')
