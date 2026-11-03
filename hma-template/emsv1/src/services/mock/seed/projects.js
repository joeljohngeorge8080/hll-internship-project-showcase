// Project portfolio seed: eight fictional projects across the four types the
// app understands, each with installments, milestones, a monthly plan and
// expense history. Funders and places are invented.
import seedEmployees from '../../seedEmployees.json'
import { daysFromNow, isoNow, monthStart, sid } from './helpers'

export const empUuid = (code) => seedEmployees.find((e) => e.employee_id === code)?.id || null

const PROJECTS = [
  {
    code: 'HMA-PH-001',
    type: 'Other Public Health',
    status: 'ongoing',
    title: 'Community Health Outreach – Highland Belt',
    funding_agency: 'Greenleaf Health Foundation',
    partner: 'Highland Care Trust',
    location: 'Highland Block',
    district: 'Wayanad',
    value: 4800000,
    pa: 'EMP3351',
    officers: ['EMP2721', 'EMP2722'],
    target: 1200,
    done: 640,
    start: -8,
    end: 10,
  },
  {
    code: 'HMA-PH-002',
    type: 'Other Public Health',
    status: 'ongoing',
    title: 'Urban Sanitation Awareness Drive',
    funding_agency: 'CleanCity Alliance',
    partner: 'Metro Ward Forum',
    location: 'Ward 14–22',
    district: 'Ernakulam',
    value: 3200000,
    pa: 'EMP3351',
    officers: ['EMP023'],
    target: 900,
    done: 410,
    start: -6,
    end: 6,
  },
  {
    code: 'HMA-CD-003',
    type: 'Community Development',
    status: 'ongoing',
    title: 'Women Livelihood Skill Hub',
    funding_agency: 'Riverbend Development Fund',
    partner: 'Sakhi Collective',
    location: 'Kuttanad',
    district: 'Alappuzha',
    value: 6000000,
    pa: 'EMP2707',
    officers: ['EMP4831', 'EMP2414'],
    target: 500,
    done: 260,
    start: -9,
    end: 9,
  },
  {
    code: 'HMA-MC-004',
    type: 'M-CUP',
    status: 'ongoing',
    title: 'School Nutrition Support Programme',
    funding_agency: 'Sunrise Children’s Trust',
    partner: 'District Education Office',
    location: 'Taluk Schools',
    district: 'Thrissur',
    value: 2750000,
    pa: 'EMP2707',
    officers: ['EMP2752'],
    target: 2000,
    done: 1350,
    start: -5,
    end: 7,
  },
  {
    code: 'HMA-CN-005',
    type: 'Consultancy',
    status: 'ongoing',
    title: 'Coastal Resilience Planning Consultancy',
    funding_agency: 'Blue Horizon Partners',
    partner: 'Coastal Panchayat Union',
    location: 'Coastal Belt',
    district: 'Kozhikode',
    value: 1900000,
    pa: 'EMP2707',
    officers: ['EMP2815'],
    target: 30,
    done: 12,
    start: -4,
    end: 5,
  },
  {
    code: 'HMA-CD-006',
    type: 'Community Development',
    status: 'approved',
    title: 'Digital Literacy for Senior Citizens',
    funding_agency: 'Open Doors Foundation',
    partner: 'Elders Welfare Society',
    location: 'Town Centres',
    district: 'Kannur',
    value: 2200000,
    pa: 'EMP2707',
    officers: ['EMP4073'],
    target: 700,
    done: 0,
    start: 1,
    end: 13,
  },
  {
    code: 'HMA-PH-007',
    type: 'Other Public Health',
    status: 'pipeline',
    title: 'Mobile Clinic Pilot',
    funding_agency: 'Wellspring Grants',
    partner: null,
    location: 'Remote Hamlets',
    district: 'Idukki',
    value: 3600000,
    pa: 'EMP3351',
    officers: [],
    target: 1500,
    done: 0,
    start: 3,
    end: 15,
  },
  {
    code: 'HMA-CD-008',
    type: 'Community Development',
    status: 'completed',
    title: 'Rural Water Access Initiative',
    funding_agency: 'Riverbend Development Fund',
    partner: 'Gram Jal Samiti',
    location: 'Interior Villages',
    district: 'Palakkad',
    value: 3900000,
    pa: 'EMP2707',
    officers: ['EMP040'],
    target: 800,
    done: 800,
    start: -20,
    end: -2,
  },
]

export const PROJECT_IDS = PROJECTS.map((_, i) => sid('prj', i + 1))

export const buildProjects = () => {
  const t = {
    projects: [],
    project_officer_assignments: [],
    project_installments: [],
    project_milestones: [],
    project_risks: [],
    project_field_personnel: [],
    project_notes: [],
    project_activities: [],
    project_personnel_details: [],
    project_monthly_plan: [],
    project_monthly_plan_phases: [],
    project_pool_adjustments: [],
    project_sent_allocations: [],
    project_expenses: [],
    project_pool_pct_adjustments: [],
    donors: [],
    beneficiaries: [],
    beneficiary_follow_ups: [],
  }
  const created = isoNow()

  PROJECTS.forEach((p, i) => {
    const id = PROJECT_IDS[i]
    const started = p.status === 'ongoing' || p.status === 'completed'
    const progress =
      p.status === 'completed' ? 1 : started ? Math.min(0.85, -p.start / (p.end - p.start)) : 0
    const received = Math.round(p.value * (p.status === 'pipeline' ? 0 : progress + 0.1))
    const spent = Math.round(received * 0.78)

    t.projects.push({
      id,
      project_code: p.code,
      project_type: p.type,
      title: p.title,
      description: `${p.title} — a fictional demonstration project run with ${p.partner || 'local partners'}.`,
      funding_agency: p.funding_agency,
      implementing_partner: p.partner,
      location: p.location,
      district: p.district,
      status: p.status,
      phase: p.status,
      project_value: p.value,
      amount_received: received,
      amount_sanctioned: Math.round(p.value * (started ? 0.9 : 0.5)),
      amount_spent: spent,
      amount_utilized: Math.round(spent * 0.9),
      expense_accounted: Math.round(spent * 0.95),
      committed_expense: Math.round(p.value * 0.05),
      start_date: monthStart(p.start),
      end_date: monthStart(p.end),
      beneficiaries_target: p.target,
      beneficiaries_completed: p.done,
      project_associate_id: empUuid(p.pa),
      core_pct: 5,
      hr_pct: 5,
      admin_pct: 5,
      remarks: null,
      status_ts_note: null,
      operations_activated_month: started ? monthStart(p.start) : null,
      operations_activated_at: started ? created : null,
      created_at: created,
      updated_at: created,
    })

    p.officers.forEach((code) =>
      t.project_officer_assignments.push({
        project_id: id,
        employee_id: empUuid(code),
        assigned_at: created,
      }),
    )

    // Three installments: 40 / 40 / 20.
    ;[40, 40, 20].forEach((pct, k) => {
      const paid = started && k <= Math.floor(progress * 3)
      t.project_installments.push({
        id: sid(`ins${i}`, k + 1),
        project_id: id,
        label: `Installment ${k + 1}`,
        percentage: pct,
        amount: Math.round((p.value * pct) / 100),
        phase_name: `Phase ${k + 1}`,
        start_date: monthStart(p.start + k * 4),
        target_date: monthStart(p.start + k * 4 + 3),
        actual_date: paid ? monthStart(p.start + k * 4 + 1) : null,
        uc_status: paid ? (k === 0 ? 'Approved' : 'Submitted') : 'Pending',
        payment_received_date: paid ? monthStart(p.start + k * 4 + 1) : null,
        uc_target_date: monthStart(p.start + k * 4 + 5),
        actual_uc_submission_date: paid && k === 0 ? monthStart(p.start + 5) : null,
      })
    })
    ;['Baseline survey', 'Mid-term review', 'Final report'].forEach((title, k) =>
      t.project_milestones.push({
        id: sid(`mil${i}`, k + 1),
        project_id: id,
        title,
        amount: Math.round(p.value * [0.1, 0.15, 0.1][k]),
        target_date: monthStart(p.start + 2 + k * 4),
        actual_date: started && progress > (k + 1) / 4 ? monthStart(p.start + 2 + k * 4) : null,
        uc_status: started && progress > (k + 1) / 4 ? 'approved' : 'pending',
      }),
    )

    t.project_risks.push({
      id: sid(`rsk${i}`, 1),
      project_id: id,
      title: 'Delay in partner fund release',
      severity: ['Low', 'Medium', 'High'][i % 3],
      status: 'Open',
    })

    t.project_notes.push({
      id: sid(`not${i}`, 1),
      project_id: id,
      created_by: empUuid(p.pa),
      note: 'Field visit completed; partner reports steady community turnout.',
      created_at: created,
    })
    t.project_activities.push({
      id: sid(`act${i}`, 1),
      project_id: id,
      created_by: empUuid(p.pa),
      description: 'Community mobilisation meetings',
      target_date: daysFromNow(20 + i),
      risk_challenges: 'Monsoon access issues',
      status: started ? 'In Progress' : 'Planned',
      created_at: created,
      updated_at: created,
    })
    t.project_personnel_details.push({
      id: sid(`ppd${i}`, 1),
      project_id: id,
      name: 'Local volunteer coordinator',
      age: 34,
      phone: '9000000000',
      created_at: created,
    })
    t.project_field_personnel.push({
      id: sid(`fld${i}`, 1),
      project_id: id,
      name: 'Field associate',
      email: `field${i + 1}@example.com`,
      status: 'active',
      invited_at: created,
    })

    // Monthly plan: three months back → four ahead (clamped to the project span).
    if (started || p.status === 'approved') {
      for (let m = -3; m <= 4; m += 1) {
        const month = monthStart(m)
        const planId = sid(`pln${i}`, m + 4)
        const total = Math.round((p.value / (p.end - p.start)) * 0.85)
        const past = m < 0
        t.project_monthly_plan.push({ id: planId, project_id: id, month, total })
        ;[
          ['Phase 1', 'Field activities', 0.6],
          ['Phase 2', 'Training & materials', 0.4],
        ].forEach(([phase, name, share], k) =>
          t.project_monthly_plan_phases.push({
            id: sid(`phs${i}`, (m + 4) * 10 + k),
            monthly_plan_id: planId,
            phase,
            name,
            amount: Math.round(total * share),
            actual: past ? Math.round(total * share * 0.93) : null,
          }),
        )
        if (past && started) {
          t.project_expenses.push({
            id: sid(`pex${i}`, m + 4),
            project_id: id,
            pool: 'project',
            month,
            amount: Math.round(total * 0.93),
            label: 'Monthly programme expenses',
            expense_date: month,
            logged_by: 'Demo Finance',
            created_at: created,
          })
        }
      }
      t.project_sent_allocations.push({
        id: sid(`snt${i}`, 1),
        project_id: id,
        pool: 'hr',
        month: monthStart(-1),
        amount: Math.round(p.value * 0.005),
        sent_by: empUuid('EMP002'),
        sent_at: created,
      })
      t.project_pool_adjustments.push({
        id: sid(`adj${i}`, 1),
        project_id: id,
        pool: 'core',
        month: monthStart(-1),
        amount: Math.round(p.value * 0.002),
        source: 'manual',
        reason: 'Quarterly rebalancing',
        counter_month: null,
        created_by: empUuid('EMP002'),
        created_at: created,
      })
    }

    t.donors.push({
      id: sid('don', i + 1),
      funding_agency: p.funding_agency,
      location: p.district,
      project_id: id,
      project_name: p.title,
      num_beneficiaries: p.target,
      project_value: p.value,
      year: new Date().getFullYear(),
      start_date: monthStart(p.start),
      end_date: monthStart(p.end),
      notes: null,
      created_at: created,
      updated_at: created,
    })

    if (started) {
      ;['Asha K.', 'Biju T.', 'Chitra M.', 'Dinesh P.'].forEach((name, k) => {
        const bid = sid(`ben${i}`, k + 1)
        t.beneficiaries.push({
          id: bid,
          project_id: id,
          name,
          age: 28 + k * 9,
          apl_bpl: k % 2 ? 'APL' : 'BPL',
          place_ward: `Ward ${k + 3}`,
          phone: '9000000000',
          address: `${p.location}, ${p.district}`,
          occupation: ['Farmer', 'Tailor', 'Daily wage', 'Homemaker'][k],
          notes: null,
        })
        t.beneficiary_follow_ups.push({
          id: sid(`bfu${i}`, k + 1),
          beneficiary_id: bid,
          follow_up_date: daysFromNow(7 + k * 5),
          completed: k === 0,
          notes: 'Routine check-in',
        })
      })
    }
  })

  return t
}
