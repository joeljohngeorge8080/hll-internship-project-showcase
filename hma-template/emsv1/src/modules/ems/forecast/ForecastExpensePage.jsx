/**
 * ForecastExpensePage.jsx
 * EMS › Forecast › Forecast Expense
 *
 * Standalone route for the HR & Admin actual + forecast view that used to
 * live as a tab inside Expense Management. Delegates entirely to
 * GeneralExpensesTab, which owns all the data loading, editing, and WMA
 * forecast logic — this page just gives it its own place in the sidebar.
 */
import React from 'react'
import GeneralExpensesTab from '../expense-management/GeneralExpensesTab'

const ForecastExpensePage = () => (
  <>
    <div className="mb-4">
      <h4 className="mb-1 fw-bold">Forecast Expense</h4>
      <p className="text-body-secondary mb-0 small">
        HR &amp; Admin actual expenses with a Weighted Moving Average forecast.
      </p>
    </div>
    <GeneralExpensesTab />
  </>
)

export default ForecastExpensePage
