import React, { useEffect, useState } from 'react'
import WidgetCard from '../../../../components/dashboard/WidgetCard'
import { computeProfitLossTotals } from '../../../../services/forecastData'

const ProfitLossWidget = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    const load = async () => {
      const year = new Date().getFullYear()
      const result = await computeProfitLossTotals(`${year}-01`, `${year}-12`)
      setData(result)
    }
    load()
  }, [])

  if (!data) return null

  return (
    <WidgetCard
      label={`Profit / Loss (${new Date().getFullYear()})`}
      badge={{
        text: data.isProfit ? 'Profit' : 'Loss',
        color: data.isProfit ? 'success' : 'danger',
      }}
      stat={{
        value: `${data.expenses.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} vs ${data.ownRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`,
        color: data.isProfit ? '#06d6a0' : '#ef476f',
      }}
      sentence={
        data.isProfit
          ? `Surplus ${data.surplus.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} — fully self-funded`
          : `${data.gapAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} (${(data.gapSharePct ?? 0).toFixed(1)}%) must come from Govt grants`
      }
    />
  )
}

export default ProfitLossWidget
