// ─── CTC Calculation Engine ───────────────────────────────────────────────────
// Extracted to a plain utility file (no React) so that SalaryTab.jsx can be a
// pure-component file and Vite Fast Refresh works correctly.
// Based on ctc detailed list.csv format.

// Shared between SalaryTab.jsx and MonthlySalaryDetailsTab.jsx so the two
// tabs never carry independent copies of this lookup that could drift apart.
export const STATE_PT_MAP = {
  Kerala: 200,
  Karnataka: 200,
  Maharashtra: 200,
  'Tamil Nadu': 167,
  'West Bengal': 110,
  'Andhra Pradesh': 150,
  Telangana: 150,
  Gujarat: 0,
  Delhi: 0,
  Other: 0,
}

export const computeCTC = ({
  idealBasic = 0,
  da = 0,
  tnd = 30,
  tndw = 0,
  pt = 0,
  recovery = 0,
  centreInchargeAllowance = 0,
  rsoAllowance = 0,
  serviceChargeRate = 1.5,
}) => {
  const basic = Number(idealBasic) || 0
  const dearness = Number(da) || 0
  const totalDays = Number(tnd) || 30
  const daysPresent = Number(tndw) || 0
  const cia = Number(centreInchargeAllowance) || 0
  const rso = Number(rsoAllowance) || 0

  // Ideal components
  const idealHRA = basic * 0.3
  const idealOA = basic * 0.1
  const idealGross = basic + dearness + idealHRA + idealOA + cia + rso

  // Actual components (prorated by attendance)
  const ratio = totalDays > 0 ? daysPresent / totalDays : 0
  const actualBasic = basic * ratio
  const actualDA = dearness * ratio
  const actualHRA = actualBasic * 0.3
  const actualOA = actualBasic * 0.1
  const actualGross = actualBasic + actualDA + actualHRA + actualOA + cia + rso

  // Employee deductions
  const empEPFO = actualBasic * 0.12
  const empESIC = idealGross < 21000 ? actualGross * 0.0075 : 0
  const ptAmt = Number(pt) || 0
  const recoveryAmt = Number(recovery) || 0
  const empLWF = 50
  const groupInsurance = idealGross < 21000 ? 0 : 200
  const totalDeduction = empEPFO + empESIC + ptAmt + recoveryAmt + empLWF + groupInsurance
  const netSalary = actualGross - totalDeduction

  // Employer contributions
  const employerPF = actualBasic * 0.12
  const pfAdmin = actualBasic * 0.005
  const edli = actualBasic * 0.005
  const employerESIC = idealGross < 21000 ? actualGross * 0.0325 : 0
  const employerLWF = 50
  const totalEmployerContribution = employerPF + pfAdmin + edli + employerESIC + employerLWF

  // CTC and Invoice — service charge rate is person-specific, overridable per
  // employee (falls back to the global rate config when not overridden).
  const ctc = actualGross + totalEmployerContribution
  const serviceCharges = ctc * ((Number(serviceChargeRate) || 0) / 100)
  const invoiceAmount = ctc + serviceCharges
  const igst = invoiceAmount * 0.18
  const totalInvoiceAmount = invoiceAmount + igst

  return {
    idealBasic: basic,
    idealDA: dearness,
    idealHRA,
    idealOA,
    cia,
    rso,
    idealGross,
    tnd: totalDays,
    tndw: daysPresent,
    actualBasic,
    actualDA,
    actualHRA,
    actualOA,
    actualGross,
    empEPFO,
    empESIC,
    ptAmt,
    recoveryAmt,
    empLWF,
    groupInsurance,
    totalDeduction,
    netSalary,
    employerPF,
    pfAdmin,
    edli,
    employerESIC,
    employerLWF,
    totalEmployerContribution,
    ctc,
    serviceChargeRate: Number(serviceChargeRate) || 0,
    serviceCharges,
    invoiceAmount,
    igst,
    totalInvoiceAmount,
  }
}

// HRA/OA no longer auto-calculate from Basic — HR types these directly on
// both salary-entry screens (SalaryTab.jsx and MonthlySalaryDetailsTab.jsx).
// Implemented as permanent entries in the existing ctcOverrides/overrides map
// (already persisted/threaded through per record) rather than a schema
// change: eff() in computeEffectiveCTC only falls back to the formula when an
// override is undefined/null/'', so defaulting these to '0' whenever the map
// is (re)initialized means the formula never runs, satisfying "remove the
// formula" rather than just "allow overriding it". Shared here — like
// STATE_PT_MAP above — so the two tabs never carry independent copies that
// could drift apart (see the Sep 2026 bug where SalaryTab kept recomputing
// 30%/10% because it had its own un-defaulted overrides state).
export const HRA_OA_FIELDS = ['idealHRA', 'idealOA', 'actualHRA', 'actualOA']
export const withHraOaDefaults = (overrides) => {
  const next = { ...overrides }
  HRA_OA_FIELDS.forEach((f) => {
    if (next[f] === undefined || next[f] === null || next[f] === '') next[f] = '0'
  })
  return next
}

// Fields in the CTC breakdown that are normally derived by formula, but which
// the salary-entry screens let HR/Admin type over by hand (e.g. a rounding
// adjustment from the actual payslip). Anything not in this list — the raw
// manual inputs like idealBasic, da, tnd, tndw, pt, recovery, cia, rso — is
// already a plain editable field and has no "auto" value to override.
export const OVERRIDABLE_CTC_FIELDS = [
  'idealHRA',
  'idealOA',
  'idealGross',
  'actualBasic',
  'actualDA',
  'actualHRA',
  'actualOA',
  'actualGross',
  'empEPFO',
  'empESIC',
  'empLWF',
  'groupInsurance',
  'totalDeduction',
  'netSalary',
  'employerPF',
  'pfAdmin',
  'edli',
  'employerESIC',
  'employerLWF',
  'totalEmployerContribution',
  'ctc',
  'serviceCharges',
  'invoiceAmount',
  'igst',
  'totalInvoiceAmount',
]

// Same shape/inputs as computeCTC, but every field in OVERRIDABLE_CTC_FIELDS
// can be pinned to a manual value via `overrides` (keyed the same way, string
// or number, empty string/undefined/null meaning "not overridden"). Totals
// that depend on an overridden field are recomputed from the *effective*
// (override-or-formula) value of that field, so overriding e.g. Ideal HRA
// cascades into Ideal Gross, CTC, etc. instead of leaving them stale.
export const computeEffectiveCTC = (
  {
    idealBasic = 0,
    da = 0,
    tnd = 30,
    tndw = 0,
    pt = 0,
    recovery = 0,
    centreInchargeAllowance = 0,
    rsoAllowance = 0,
    serviceChargeRate = 1.5,
  },
  overrides = {},
) => {
  const eff = (key, computeFn) => {
    const raw = overrides[key]
    if (raw !== undefined && raw !== null && raw !== '') return Number(raw)
    return computeFn()
  }

  const basic = Number(idealBasic) || 0
  const dearness = Number(da) || 0
  const totalDays = Number(tnd) || 30
  const daysPresent = Number(tndw) || 0
  const cia = Number(centreInchargeAllowance) || 0
  const rso = Number(rsoAllowance) || 0
  const ptAmt = Number(pt) || 0
  const recoveryAmt = Number(recovery) || 0
  const ratio = totalDays > 0 ? daysPresent / totalDays : 0

  const idealHRA = eff('idealHRA', () => basic * 0.3)
  const idealOA = eff('idealOA', () => basic * 0.1)
  const idealGross = eff('idealGross', () => basic + dearness + idealHRA + idealOA + cia + rso)

  const actualBasic = eff('actualBasic', () => basic * ratio)
  const actualDA = eff('actualDA', () => dearness * ratio)
  const actualHRA = eff('actualHRA', () => actualBasic * 0.3)
  const actualOA = eff('actualOA', () => actualBasic * 0.1)
  const actualGross = eff(
    'actualGross',
    () => actualBasic + actualDA + actualHRA + actualOA + cia + rso,
  )

  const empEPFO = eff('empEPFO', () => actualBasic * 0.12)
  const empESIC = eff('empESIC', () => (idealGross < 21000 ? actualGross * 0.0075 : 0))
  const empLWF = eff('empLWF', () => 50)
  const groupInsurance = eff('groupInsurance', () => (idealGross < 21000 ? 0 : 200))
  const totalDeduction = eff(
    'totalDeduction',
    () => empEPFO + empESIC + ptAmt + recoveryAmt + empLWF + groupInsurance,
  )
  const netSalary = eff('netSalary', () => actualGross - totalDeduction)

  const employerPF = eff('employerPF', () => actualBasic * 0.12)
  const pfAdmin = eff('pfAdmin', () => actualBasic * 0.005)
  const edli = eff('edli', () => actualBasic * 0.005)
  const employerESIC = eff('employerESIC', () => (idealGross < 21000 ? actualGross * 0.0325 : 0))
  const employerLWF = eff('employerLWF', () => 50)
  const totalEmployerContribution = eff(
    'totalEmployerContribution',
    () => employerPF + pfAdmin + edli + employerESIC + employerLWF,
  )

  const rate = Number(serviceChargeRate) || 0
  const ctc = eff('ctc', () => actualGross + totalEmployerContribution)
  const serviceCharges = eff('serviceCharges', () => ctc * (rate / 100))
  const invoiceAmount = eff('invoiceAmount', () => ctc + serviceCharges)
  const igst = eff('igst', () => invoiceAmount * 0.18)
  const totalInvoiceAmount = eff('totalInvoiceAmount', () => invoiceAmount + igst)

  return {
    idealBasic: basic,
    idealDA: dearness,
    idealHRA,
    idealOA,
    cia,
    rso,
    idealGross,
    tnd: totalDays,
    tndw: daysPresent,
    actualBasic,
    actualDA,
    actualHRA,
    actualOA,
    actualGross,
    empEPFO,
    empESIC,
    ptAmt,
    recoveryAmt,
    empLWF,
    groupInsurance,
    totalDeduction,
    netSalary,
    employerPF,
    pfAdmin,
    edli,
    employerESIC,
    employerLWF,
    totalEmployerContribution,
    ctc,
    serviceChargeRate: rate,
    serviceCharges,
    invoiceAmount,
    igst,
    totalInvoiceAmount,
  }
}
