// src/modules/ems/expense-management/LsgbRevenuePage.jsx
import React from 'react'
import LsgbLedgerPanel from './LsgbLedgerPanel'

/**
 * LSGB tab (common — visible per MODULE.EXPENSE_MANAGEMENT): read-only
 * inflow/outflow ledger, same data Finance sees on their LSGB page. Adding
 * money to LSGB now happens only from Finance > LSGB (Finance/Heads role) —
 * see src/modules/ems/finance/LsgbFinancePage.jsx.
 */
const LsgbRevenuePage = () => {
  return (
    <>
      <div className="mb-3">
        <p className="text-body-secondary small mb-0">
          Every LSGB transaction — money added by Finance and expenses booked against LSGB Revenue —
          with a running balance. To add money to LSGB, use Finance &rsaquo; LSGB. To book a new
          expense against LSGB Revenue, use the Expense Booking screen.
        </p>
      </div>

      <LsgbLedgerPanel />
    </>
  )
}

export default LsgbRevenuePage
