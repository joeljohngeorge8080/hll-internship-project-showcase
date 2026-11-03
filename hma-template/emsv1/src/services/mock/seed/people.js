// Staff seed: the 73 fictional employees in ../../seedEmployees.json, widened
// from the app's nested shape into the normalized employees.* tables.
import seedEmployees from '../../seedEmployees.json'
import { daysFromNow, isoNow, sid } from './helpers'

const SALARY_BY_KEYWORD = [
  [/ceo/i, 180000],
  [/manager/i, 95000],
  [/deputy/i, 85000],
  [/lead/i, 78000],
  [/co ordinator/i, 72000],
  [/associate/i, 52000],
  [/senior accounts/i, 48000],
  [/project officer/i, 36000],
  [/counsellor/i, 32000],
  [/assistant/i, 26000],
  [/facilitator/i, 28000],
  [/staff|cleaning|security/i, 18000],
]

const salaryFor = (designation, index) => {
  const hit = SALARY_BY_KEYWORD.find(([re]) => re.test(designation))
  return (hit ? hit[1] : 24000) + (index % 5) * 500
}

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '')

export const buildPeople = () => {
  const tables = {
    employees: [],
    employee_contacts: [],
    employee_addresses: [],
    employee_employment: [],
    employee_identification: [],
    employee_bank_accounts: [],
    employee_family_members: [],
    salary_history: [],
  }
  const created = isoNow()

  seedEmployees.forEach((e, i) => {
    const id = e.id
    // The 9 attendance-only rows ship without an employment record; give them
    // a plausible one so every employee has a department and designation.
    const designation = e.employment.designation || 'Project Officer'
    const department = e.employment.department || 'SDP'
    const salary = salaryFor(designation, i)

    tables.employees.push({
      id,
      employee_id: e.employee_id,
      first_name: e.first_name,
      middle_name: e.middle_name || null,
      last_name: e.last_name,
      gender: e.gender || (i % 2 ? 'Female' : 'Male'),
      date_of_birth: `${1980 + (i % 18)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      marital_status: i % 3 ? 'Married' : 'Single',
      blood_group: ['A+', 'B+', 'O+', 'AB+', 'O-'][i % 5],
      employee_category: e.employee_category || 'TPC',
      status: 'active',
      joined_date: daysFromNow(-(200 + ((i * 37) % 1400))),
      exit_date: null,
      deleted_at: null,
      deleted_remarks: null,
      current_salary: salary,
      photo_url: null,
      created_at: created,
      updated_at: created,
    })

    const handle = `${slug(e.first_name)}.${slug(e.last_name)}${i}`
    tables.employee_contacts.push({
      employee_id: id,
      personal_email: `${handle}@example.com`,
      working_email: `${handle}@hma-demo.example.com`,
      mobile: `90000${String(10000 + i * 7).slice(-5)}`,
      phone: null,
      emergency_contact_name: 'Family contact',
      emergency_contact_phone: `91000${String(10000 + i * 11).slice(-5)}`,
    })
    tables.employee_addresses.push({
      employee_id: id,
      resident_location: ['Kochi', 'Thrissur', 'Kozhikode', 'Thiruvananthapuram', 'Kannur'][i % 5],
      present_address: `${10 + i}, Demo Nagar, Kerala`,
      permanent_address: `${10 + i}, Demo Nagar, Kerala`,
      state: 'Kerala',
    })
    tables.employee_employment.push({
      employee_id: id,
      designation,
      department,
      reporting_to: i < 9 ? null : seedEmployees[2].id,
      working_region: 'South',
      working_state: 'Kerala',
      start_date: tables.employees[i].joined_date,
      end_date: null,
    })
    tables.employee_identification.push({
      employee_id: id,
      pan: `DEMOP${String(1000 + i)}X`,
      aadhar: `0000 0000 ${String(1000 + i)}`,
      passport: null,
      uan: `1000000${String(1000 + i)}`,
      esi_number: null,
      pf_number: `KR/DEMO/${String(1000 + i)}`,
    })
    tables.employee_bank_accounts.push({
      id: sid('bnk', i + 1),
      employee_id: id,
      bank_name: 'Demo Bank',
      account_number: `00000${String(100000 + i)}`,
      ifsc: 'DEMO0001234',
      is_primary: true,
      created_at: created,
    })
    if (i % 3 === 0) {
      tables.employee_family_members.push({
        id: sid('fam', i + 1),
        employee_id: id,
        name: `Family member of ${e.first_name}`,
        relation: 'Spouse',
        date_of_birth: '1990-01-01',
        created_at: created,
      })
    }
    tables.salary_history.push({
      id: sid('sal', i + 1),
      employee_id: id,
      previous_salary: Math.round(salary * 0.92),
      increment_pct: 8.7,
      increment_amount: salary - Math.round(salary * 0.92),
      new_salary: salary,
      effective_date: daysFromNow(-120),
      designation_changed_to: null,
      ctc_breakdown: null,
      remarks: 'Annual revision',
      created_by: null,
      created_at: created,
    })
  })

  return tables
}
