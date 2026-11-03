// Operations seed: attendance, holidays, expenses, payroll, announcements and
// the other org-level tables that sit beside projects and staff.
import seedEmployees from '../../seedEmployees.json'
import { daysFromNow, isoDate, isoNow, monthParts, monthStart, sid } from './helpers'
import { empUuid, PROJECT_IDS } from './projects'

const created = isoNow()
const pad = (n) => String(n).padStart(2, '0')

const HOLIDAYS = [
  [1, 1, 'New Year’s Day'],
  [1, 26, 'Republic Day'],
  [5, 1, 'Labour Day'],
  [8, 15, 'Independence Day'],
  [10, 2, 'Gandhi Jayanti'],
  [12, 25, 'Christmas'],
]

const buildHolidays = () => {
  const year = new Date().getFullYear()
  return HOLIDAYS.map(([month, day, name], i) => ({
    id: sid('hol', i + 1),
    holiday_date: `${year}-${pad(month)}-${pad(day)}`,
    name,
    year,
    month,
    created_at: created,
  }))
}

// Last full month plus the current month up to yesterday, for every employee.
const buildAttendance = (holidays) => {
  const records = []
  const summaries = []
  const uploads = []
  const holidayDates = new Set(holidays.map((h) => h.holiday_date))
  const now = new Date()

  ;[-1, 0].forEach((offset) => {
    const { year, month } = monthParts(offset)
    const uploadId = sid('upl', offset + 2)
    const daysInMonth = new Date(year, month, 0).getDate()
    uploads.push({
      id: uploadId,
      file_name: `attendance-${year}-${pad(month)}.xlsx`,
      year,
      month,
      total_records: 0,
      valid_records: 0,
      total_employees: seedEmployees.length,
      status: 'completed',
      uploaded_by: empUuid('EMP004'),
      uploaded_at: created,
      uploaded_by_name: 'Dev Varma',
      file_path: null,
    })

    seedEmployees.forEach((emp, ei) => {
      const tally = { present: 0, half: 0, absent: 0, leave: 0, late: 0 }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day)
        if (date >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) break
        const iso = isoDate(date)
        let status = 'present'
        if (date.getDay() === 0) status = 'weekly_off'
        else if (holidayDates.has(iso)) status = 'holiday'
        else {
          const roll = (ei * 31 + day * 17 + month * 7) % 40
          if (roll === 0) status = 'absent'
          else if (roll === 1) status = 'on_leave'
          else if (roll === 2) status = 'half_day'
        }
        const working = status === 'present' || status === 'half_day'
        const late = working && (ei + day) % 9 === 0 ? 14 : 0
        if (status === 'present') tally.present += 1
        if (status === 'half_day') tally.half += 1
        if (status === 'absent') tally.absent += 1
        if (status === 'on_leave') tally.leave += 1
        if (late) tally.late += 1
        records.push({
          id: sid(`att${ei}`, offset * 40 + day + 100),
          employee_id: emp.id,
          attendance_date: iso,
          year,
          month,
          status,
          in_time: working ? (late ? '09:44:00' : '09:28:00') : null,
          out_time: working ? (status === 'half_day' ? '13:30:00' : '17:35:00') : null,
          work_duration_minutes: working ? (status === 'half_day' ? 240 : 485) : 0,
          late_by_minutes: late,
          early_by_minutes: 0,
          is_weekly_off_type: status === 'weekly_off',
          overtime_minutes: 0,
          shift: 'General',
          pre_holiday_status: null,
          upload_id: uploadId,
          leave_type: status === 'on_leave' ? 'Casual Leave' : null,
          created_at: created,
          updated_at: created,
        })
      }
      summaries.push({
        id: sid(`sum${ei}`, offset + 2),
        employee_id: emp.id,
        year,
        month,
        present_days: tally.present,
        half_days: tally.half,
        absent_days: tally.absent,
        leave_days: tally.leave,
        overtime_minutes: 0,
        late_count: tally.late,
        early_count: 0,
        present_count: tally.present,
        updated_at: created,
      })
    })
  })
  uploads.forEach((u) => {
    const n = records.filter((r) => r.upload_id === u.id).length
    u.total_records = n
    u.valid_records = n
  })
  return {
    attendance_records: records,
    attendance_summaries: summaries,
    attendance_uploads: uploads,
  }
}

const CATEGORIES = [
  'Rent',
  'Electricity',
  'Internet & Phone',
  'Software Subscriptions',
  'Travel & Fuel',
  'Office Supplies',
]

const buildExpenses = () => {
  const expense_categories = CATEGORIES.map((name, i) => ({
    id: sid('cat', i + 1),
    name,
    description: `${name} — demo category`,
    is_active: true,
    created_at: created,
    updated_at: created,
  }))

  const general_expenses = []
  ;[-2, -1, 0].forEach((offset) => {
    const { year, month } = monthParts(offset)
    expense_categories.forEach((cat, i) => {
      const planned = 8000 + i * 6500
      general_expenses.push({
        id: sid(`gen${i}`, offset + 3),
        category_id: cat.id,
        expense_name: `${cat.name} – ${pad(month)}/${year}`,
        month,
        year,
        frequency: 'Monthly',
        planned_amount: planned,
        actual_amount: offset < 0 ? Math.round(planned * (0.9 + (i % 3) * 0.05)) : null,
        status: offset < 0 ? 'Paid' : 'Pending',
        remarks: null,
        upload_id: null,
        created_at: created,
        updated_at: created,
      })
    })
  })

  const admin_expenses = [
    'CloudHost Demo',
    'Docs Suite Demo',
    'Insurance Demo',
    'Audit Fees Demo',
  ].map((vendor, i) => ({
    id: sid('adm', i + 1),
    vendor_name: vendor,
    expense_category: ['Hosting', 'Software', 'Insurance', 'Professional Fees'][i],
    frequency: ['Monthly', 'Monthly', 'Yearly', 'Yearly'][i],
    annual_amount: [96000, 48000, 60000, 120000][i],
    expense_group: 'Admin',
    status: 'active',
    remarks: null,
    created_at: created,
    updated_at: created,
  }))
  const admin_expense_monthly_actuals = admin_expenses.flatMap((a, i) =>
    [-3, -2, -1].map((m) => ({
      id: sid(`aea${i}`, m + 4),
      admin_expense_id: a.id,
      year_month: monthStart(m),
      amount: Math.round(a.annual_amount / 12),
    })),
  )

  const pool_expenses = []
  const pool_expense_allocations = []
  ;[
    ['hr', 'Recruitment portal', 'HireDemo'],
    ['core', 'Office lease', 'PropDemo'],
    ['admin', 'Accounting software', 'LedgerDemo'],
  ].forEach(([pool, label, vendor], i) => {
    const peId = sid('pex', i + 1)
    const amount = 24000 + i * 9000
    pool_expenses.push({
      id: peId,
      pool,
      label,
      vendor,
      frequency: 'Monthly',
      yearly_price: amount * 12,
      amount,
      expense_date: monthStart(-1),
      notes: null,
      bill_no: `DEMO-${100 + i}`,
      entered_by_project_id: null,
      revenue_sources: [],
      hr_revenue_pct: 0,
      lsgb_revenue_pct: 0,
      project_pool_pct: 100,
      admin_share_pct: 0,
      created_by: empUuid('EMP002'),
      created_at: created,
      updated_at: created,
      employee_id: null,
      payment_mode: 'Bank Transfer',
      bill_date: monthStart(-1),
    })
    PROJECT_IDS.slice(0, 3).forEach((pid, k) =>
      pool_expense_allocations.push({
        id: sid(`pea${i}`, k + 1),
        pool_expense_id: peId,
        project_id: pid,
        share_pct: [50, 30, 20][k],
        amount_charged: Math.round(amount * [0.5, 0.3, 0.2][k]),
      }),
    )
  })

  return {
    expense_categories,
    general_expenses,
    admin_expenses,
    admin_expense_monthly_actuals,
    pool_expenses,
    pool_expense_allocations,
  }
}

const buildPayroll = () => {
  const core_salaries = []
  const salary_details = []
  const core = seedEmployees.slice(0, 10)
  ;[-2, -1, 0].forEach((offset) => {
    const { year, month } = monthParts(offset)
    core.forEach((emp, i) => {
      const planned = 40000 + i * 4500
      core_salaries.push({
        id: sid(`core${i}`, offset + 3),
        employee_id: emp.id,
        month,
        year,
        planned_amount: planned,
        actual_amount: offset < 0 ? planned : null,
        status: offset < 0 ? 'Paid' : 'Pending',
        remarks: null,
        created_at: created,
        updated_at: created,
      })
    })
  })
  seedEmployees.forEach((emp, i) => {
    const { year, month } = monthParts(-1)
    salary_details.push({
      id: sid('sdt', i + 1),
      employee_id: emp.id,
      year,
      month,
      ideal_basic: 20000 + (i % 8) * 1500,
      pt: 200,
      recovery: 0,
      tnd: 0,
      tndw: 0,
      centre_incharge_allowance: 0,
      rso_allowance: 0,
      invoice_no: `INV-DEMO-${i + 1}`,
      hc_no: null,
      state: 'Kerala',
      remarks: null,
      da: 0,
      pt_auto: true,
      pt_override: null,
      created_at: created,
      updated_at: created,
      ctc_overrides: null,
    })
  })
  return { core_salaries, salary_details }
}

const buildOrgSupport = () => ({
  announcements: [
    {
      id: sid('ann', 1),
      announcement_type: 'announcement',
      title: 'Welcome to the HMA IEMS showcase',
      body: 'This is a demonstration environment. Every name, figure and project here is fictional.',
      target_roles: [],
      sent_by: empUuid('EMP001'),
      sent_at: created,
      sent_by_name: 'Om Verma',
    },
    {
      id: sid('ann', 2),
      announcement_type: 'reminder',
      title: 'Submit monthly utilisation certificates',
      body: 'Project teams: please upload this month’s UC documents before the 28th.',
      target_roles: ['project_officer', 'project_associate'],
      sent_by: empUuid('EMP001'),
      sent_at: created,
      sent_by_name: 'Om Verma',
    },
    {
      id: sid('ann', 3),
      announcement_type: 'info',
      title: 'Attendance import completed',
      body: 'Last month’s attendance has been imported and reconciled.',
      target_roles: ['hr', 'admin'],
      sent_by: empUuid('EMP004'),
      sent_at: created,
      sent_by_name: 'Dev Varma',
    },
  ],
  notifications: [
    {
      id: sid('ntf', 1),
      message: 'Installment 2 for Women Livelihood Skill Hub is due next month.',
      role_target: 'project_associate',
      related_project_id: PROJECT_IDS[2],
      notification_type: 'installment',
      is_read: false,
      created_at: created,
    },
    {
      id: sid('ntf', 2),
      message: 'Monthly pool allocation is ready for review.',
      role_target: 'heads',
      related_project_id: null,
      notification_type: 'finance',
      is_read: false,
      created_at: created,
    },
  ],
  ceo_notes: [
    {
      id: sid('ceo', 1),
      title: 'Board prep',
      body: 'Review pipeline conversion and Q4 funding gaps.',
      color: 'warning',
      created_by: empUuid('EMP001'),
      created_by_name: 'Om Verma',
      created_at: created,
      updated_at: created,
    },
  ],
  internships: [
    {
      id: sid('int', 1),
      name: 'Anjali R.',
      institution: 'Demo College of Social Work',
      department: 'SDP',
      start_date: daysFromNow(-40),
      end_date: daysFromNow(50),
      supervisor: empUuid('EMP003'),
      status: 'Ongoing',
      amount_received: 15000,
      payment_status: 'Paid',
      remarks: null,
      amount_receivable: 0,
    },
    {
      id: sid('int', 2),
      name: 'Mohan S.',
      institution: 'Sample Institute of Management',
      department: 'Finance',
      start_date: daysFromNow(10),
      end_date: daysFromNow(100),
      supervisor: empUuid('EMP002'),
      status: 'Upcoming',
      amount_received: 0,
      payment_status: 'Pending',
      remarks: null,
      amount_receivable: 15000,
    },
  ],
  recruitments: [
    {
      id: sid('rec', 1),
      activity_type: 'Campus drive',
      candidate_name: 'Divya P.',
      position: 'Project Officer',
      department: 'SDP',
      date_applied: daysFromNow(-15),
      interview_date: daysFromNow(3),
      status: 'Interview Scheduled',
      amount_received: 0,
      payment_status: 'Pending',
      remarks: null,
      amount_receivable: 0,
    },
    {
      id: sid('rec', 2),
      activity_type: 'Walk-in',
      candidate_name: 'Arun K.',
      position: 'Accounts Assistant',
      department: 'Finance',
      date_applied: daysFromNow(-8),
      interview_date: null,
      status: 'Applied',
      amount_received: 0,
      payment_status: 'Pending',
      remarks: null,
      amount_receivable: 0,
    },
  ],
  daily_reports: [
    {
      id: sid('rpt', 1),
      report_type: 'field_visit',
      submitted_by: 'EMP2721',
      submitted_by_name: 'Rohan Bose',
      submitted_at: created,
      bill_topic: null,
      amount: null,
      report_date: daysFromNow(-1),
      report_time: '16:30',
      notes: 'Completed house visits in two wards; 18 beneficiaries screened.',
      geo_photos: [],
      bill_uploads: [],
      meetings: [],
      task_id: null,
      task_title: null,
      requested_status: null,
      status: 'submitted',
      decline_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      forwarded_to_backend_at: null,
      settled_at: null,
      created_at: created,
      updated_at: created,
    },
  ],
  audit_logs: [
    {
      id: sid('aud', 1),
      created_at: created,
      entry_kind: 'manual',
      action: 'INSERT',
      actor_employee_id: empUuid('EMP001'),
      actor_name: 'Om Verma',
      actor_role: 'ceo',
      table_name: 'Auth',
      action_label: 'USER_LOGIN',
      record_id: 'EMP001',
      record_label: 'Om Verma',
      old_data: null,
      new_data: null,
      details: 'Om Verma logged in as CEO',
    },
    {
      id: sid('aud', 2),
      created_at: created,
      entry_kind: 'trigger',
      action: 'UPDATE',
      actor_employee_id: empUuid('EMP004'),
      actor_name: 'Dev Varma',
      actor_role: 'hr',
      table_name: 'employees',
      action_label: null,
      record_id: empUuid('EMP2408'),
      record_label: null,
      old_data: { designation: 'Field Assistant' },
      new_data: { designation: 'Project Assistant' },
      details: null,
    },
  ],
})

export const buildOperations = () => {
  const holidays = buildHolidays()
  return {
    holidays,
    ...buildAttendance(holidays),
    ...buildExpenses(),
    ...buildPayroll(),
    ...buildOrgSupport(),
  }
}
