# HMA IEMS - ML Requirements

## Purpose
Provide forecasting and prediction support for project expenses, financial sustainability, and overall organizational performance.

---

## ML Scope

The machine learning or formula-based prediction engine shall support:

- Expense forecasting
- Project budget prediction
- Profit / loss projection
- Budget sufficiency analysis
- Sustainability forecasting
- Predicted vs actual comparison

---

## Inputs

### Project Inputs
- Project value
- Project duration
- Project type
- Project category
- Officer assigned
- Historical cost behavior

### Financial Inputs
- Actual expenses
- Historical monthly costs
- Available reserves
- Monthly burn rate

### Operational Inputs
- Attendance trends
- Payroll trends
- Expense spikes
- Project completion rate

---

## Outputs

- Predicted budget distribution
- Monthly forecast
- Yearly forecast
- Expense risk level
- Profit / loss estimate
- Sustainability score
- Forecast confidence note

---

## Display Requirements

Forecast results shall be shown in:

- Reports & Analysis module
- Forecast dashboard cards
- Line charts
- Variance charts
- Summary tables

---

## Calculation Approach

The exact method may be:

- Formula-based estimation
- Statistical trend analysis
- ML model output from external ML team

The EMS shall consume the forecast output and display it to users.

---

## Integration Requirement

The EMS shall be able to:

- Accept forecast values from ML team
- Store forecast results
- Display forecast reports
- Compare predicted vs actual results

---

## Data Limitation Note

Forecast accuracy may be limited because historical data is only available for around one year.

The system should therefore support:
- Approximation-based forecasting
- Manual model updates
- Future model replacement