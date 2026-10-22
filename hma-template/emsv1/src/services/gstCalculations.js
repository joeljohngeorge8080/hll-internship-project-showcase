// Pure GST / input-tax-credit helpers for the Finance module.
// IMPORTANT: keep this file free of ALL imports (React, xlsx, storage) —
// it is loaded into plain node by scripts/verify-gst-calculations.mjs.

export const GST_STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  25: 'Daman & Diu',
  26: 'Dadra & Nagar Haveli and Daman & Diu',
  27: 'Maharashtra',
  28: 'Andhra Pradesh (before division)',
  29: 'Karnataka',
  30: 'Goa',
  31: 'Lakshadweep',
  32: 'Kerala',
  33: 'Tamil Nadu',
  34: 'Puducherry',
  35: 'Andaman & Nicobar Islands',
  36: 'Telangana',
  37: 'Andhra Pradesh',
  38: 'Ladakh',
  97: 'Other Territory',
  99: 'Centre Jurisdiction',
}

export const KERALA_CODE = '32'

// 15 chars: state(2 digits) + PAN(5 letters, 4 digits, 1 letter) +
// entity(1) + 'Z' + check char.
// 15-char GSTIN pattern:
//   chars  1-2  : state/UT code (2 digits)
//   chars  3-7  : PAN letters (5 uppercase letters)
//   chars  8-11 : PAN digits  (4 digits)
//   char  12    : PAN check letter (1 uppercase letter)
//   char  13    : entity number (1 digit or uppercase letter, not 0)
//   char  14    : 'Z' (reserved, always Z)
//   char  15    : checksum digit/letter
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const normalizeGstin = (gstin) =>
  String(gstin ?? '')
    .trim()
    .toUpperCase()

// Official GSTIN check character: alternating factors 1,2 over the first
// 14 chars in the base-36 charset; sum quotient+remainder of each product.
export const gstinChecksumChar = (first14) => {
  if (typeof first14 !== 'string' || first14.length !== 14) return null
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i])
    if (value < 0) return null
    const product = value * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return CHARSET[(36 - (sum % 36)) % 36]
}

export const validateGstin = (gstin) => {
  const g = normalizeGstin(gstin)
  if (!GSTIN_REGEX.test(g)) return false
  if (!GST_STATE_CODES[g.slice(0, 2)]) return false
  return gstinChecksumChar(g.slice(0, 14)) === g[14]
}

/**
 * Classifies a GSTIN into one of three statuses:
 *   'kerala'         – valid GSTIN with state code 32 (Kerala)
 *   'outside_kerala' – valid GSTIN from any other recognised state/UT
 *   'invalid'        – does not match the GSTIN format or fails checksum
 */
export const classifyGstin = (gstin) => {
  const g = normalizeGstin(gstin)
  if (!GSTIN_REGEX.test(g)) return 'invalid'
  if (!GST_STATE_CODES[g.slice(0, 2)]) return 'invalid'
  if (gstinChecksumChar(g.slice(0, 14)) !== g[14]) return 'invalid'
  return g.slice(0, 2) === KERALA_CODE ? 'kerala' : 'outside_kerala'
}

export const stateFromGstin = (gstin) => {
  const g = normalizeGstin(gstin)
  return validateGstin(g) ? GST_STATE_CODES[g.slice(0, 2)] : null
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Derive all computed grid columns for one GST bill entry.
 * Total value is GST-inclusive; taxable = total / (1 + (rate + cess)/100).
 * Kerala party (state code 32) → intra-state: CGST = SGST = GST/2.
 * Any other valid state → inter-state: IGST = full GST amount.
 * Invalid GSTIN → the split is unknowable: state/cgst/sgst/igst are null,
 * but taxable/gstAmount/cessAmount still compute (they need only numbers).
 */
export const computeGstFields = ({ gstNo, totalValue, gstRate, cessRate }) => {
  const total = toNumber(totalValue)
  const rate = toNumber(gstRate)
  const cess = toNumber(cessRate)
  const taxableValue = round2(total / (1 + (rate + cess) / 100))
  const gstAmount = round2((taxableValue * rate) / 100)
  const cessAmount = round2((taxableValue * cess) / 100)

  const gstinStatus = classifyGstin(gstNo)
  if (gstinStatus === 'invalid') {
    return {
      gstinValid: false,
      gstinStatus,
      state: null,
      taxableValue,
      gstAmount,
      cessAmount,
      cgst: null,
      sgst: null,
      igst: null,
    }
  }

  const stateCode = normalizeGstin(gstNo).slice(0, 2)
  const intraState = stateCode === KERALA_CODE
  const half = round2(gstAmount / 2)
  return {
    gstinValid: true,
    gstinStatus,
    state: intraState ? GST_STATE_CODES[stateCode] : 'Outside Kerala',
    taxableValue,
    gstAmount,
    cessAmount,
    cgst: intraState ? half : 0,
    sgst: intraState ? half : 0,
    igst: intraState ? 0 : gstAmount,
  }
}
