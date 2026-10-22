// localStorage-based task store — PROJECT-SCOPED.
// Tasks now belong to a Project, not an individual.
// Any Field Personnel who is a member of the project can see and submit against these tasks.

const KEY = 'hma_tasks_v2'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const now = () => new Date().toISOString()

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

const writeAll = (rows) => {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

export const TASK_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

// Legacy demo list kept for backward-compat with any remaining individual references
export const FIELD_PERSONNEL_LIST = [
  { id: 'fp_001', name: 'Rajesh Kumar', email: 'rajesh.kumar@example.com' },
  { id: 'fp_002', name: 'Anita Sharma', email: 'anita.sharma@example.com' },
  { id: 'fp_003', name: 'Vikram Patel', email: 'vikram.patel@example.com' },
  { id: 'fp_004', name: 'Priya Nair', email: 'priya.nair@example.com' },
  { id: 'fp_005', name: 'Suresh Reddy', email: 'suresh.reddy@example.com' },
]

export const localTasks = {
  // ── list ────────────────────────────────────────────────────────────────────
  list({ search = '', status = '', project_id = '', page = 1, pageSize = 50 } = {}) {
    let rows = readAll()

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.project_name?.toLowerCase().includes(q),
      )
    }
    if (status) rows = rows.filter((t) => t.status === status)
    if (project_id) rows = rows.filter((t) => t.project_id === project_id)

    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = rows.length
    const total_pages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    return { items: rows.slice(start, start + pageSize), total, total_pages }
  },

  // ── getById ─────────────────────────────────────────────────────────────────
  getById(id) {
    return readAll().find((t) => t.id === id) || null
  },

  // ── getByProject ────────────────────────────────────────────────────────────
  // Returns all tasks for a specific project (for Project Officer view)
  getByProject(projectId, { status = '' } = {}) {
    let rows = readAll().filter((t) => t.project_id === projectId)
    if (status) rows = rows.filter((t) => t.status === status)
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return rows
  },

  // ── getVisibleToEmail ────────────────────────────────────────────────────────
  // Returns tasks for all projects where the given email is a team member.
  // Used by Field Personnel to see their team's tasks.
  getVisibleToEmail(email, projectList = []) {
    if (!email || projectList.length === 0) return []
    const projectIds = projectList
      .filter((p) => p.field_personnel?.some((fp) => fp.email === email))
      .map((p) => p.id)

    if (projectIds.length === 0) return []

    return readAll()
      .filter((t) => projectIds.includes(t.project_id) && t.status === TASK_STATUS.ACTIVE)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  },

  // ── getByAssignee ────────────────────────────────────────────────────────────
  getByAssignee(assigneeId) {
    return readAll()
      .filter((t) => t.assignee === assigneeId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  },

  // ── getActiveTasks (legacy compat) ──────────────────────────────────────────
  getActiveTasks(projectId = '') {
    let rows = readAll().filter((t) => t.status === TASK_STATUS.ACTIVE)
    if (projectId) rows = rows.filter((t) => t.project_id === projectId)
    return rows
  },

  // ── create ──────────────────────────────────────────────────────────────────
  create(data) {
    const rows = readAll()
    const ts = now()

    const task = {
      id: uid(),
      title: data.title,
      description: data.description || '',
      project_id: data.project_id || null,
      project_name: data.project_name || 'General Project',
      // installment_id links this task to a specific project milestone/installment
      installment_id: data.installment_id || null,
      // task_type: 'task' | 'procurement'
      task_type: data.task_type || 'task',
      assignee: data.assignee || '',
      assigned_by: data.assigned_by || 'project_officer',
      assigned_at: ts,
      due_date: data.due_date || null,
      target_date: data.due_date || null,
      actual_date: data.actual_date || null,
      status: TASK_STATUS.ACTIVE,
      created_at: ts,
      updated_at: ts,
    }

    writeAll([...rows, task])
    return task
  },

  // ── getByInstallment ─────────────────────────────────────────────────────────
  // Returns all tasks for a specific installment of a project
  getByInstallment(projectId, installmentId) {
    return readAll().filter((t) => t.project_id === projectId && t.installment_id === installmentId)
  },

  // ── getByProjectGrouped ──────────────────────────────────────────────────────
  // Returns tasks for a project grouped by installment_id
  getByProjectGrouped(projectId) {
    const rows = readAll().filter((t) => t.project_id === projectId)
    const grouped = {}
    rows.forEach((task) => {
      const key = task.installment_id || 'unassigned'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(task)
    })
    return grouped
  },

  // ── update ──────────────────────────────────────────────────────────────────
  update(id, data) {
    const rows = readAll()
    const idx = rows.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Task not found')

    rows[idx] = {
      ...rows[idx],
      ...data,
      updated_at: now(),
    }

    writeAll(rows)
    return rows[idx]
  },

  // ── complete ────────────────────────────────────────────────────────────────
  complete(id) {
    const rows = readAll()
    const idx = rows.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Task not found')

    rows[idx] = { ...rows[idx], status: TASK_STATUS.COMPLETED, updated_at: now() }
    writeAll(rows)
    return rows[idx]
  },

  // ── cancel ──────────────────────────────────────────────────────────────────
  cancel(id) {
    const rows = readAll()
    const idx = rows.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Task not found')

    rows[idx] = { ...rows[idx], status: TASK_STATUS.CANCELLED, updated_at: now() }
    writeAll(rows)
    return rows[idx]
  },

  // ── delete ──────────────────────────────────────────────────────────────────
  delete(id) {
    const rows = readAll()
    const idx = rows.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Task not found')
    rows.splice(idx, 1)
    writeAll(rows)
  },

  // ── seed demo data ──────────────────────────────────────────────────────────
  seedDemoData(projects = []) {
    if (readAll().length > 0) return

    // Use real project IDs if provided, else use placeholder strings
    const proj0 = projects[0]?.id || 'demo_proj_0'
    const proj1 = projects[1]?.id || 'demo_proj_1'
    const proj2 = projects[2]?.id || 'demo_proj_2'

    const demoTasks = [
      {
        title: 'Plot A3 Foundation Survey',
        description:
          'Conduct soil inspection and document foundation readiness for Plot A3. Take geo-tagged photos.',
        project_id: proj0,
        project_name: projects[0]?.title || 'Medical College Construction',
        due_date: '2026-06-25',
      },
      {
        title: 'Block C Excavation Oversight',
        description:
          'Oversee excavation work at Block C. Submit daily labor charges and site progress photos.',
        project_id: proj0,
        project_name: projects[0]?.title || 'Medical College Construction',
        due_date: '2026-06-28',
      },
      {
        title: 'Material Procurement — Block B Phase 2',
        description: 'Purchase cement, steel, and aggregate. Submit all purchase bills.',
        project_id: proj1,
        project_name: projects[1]?.title || 'Highway Expansion Phase 2',
        due_date: '2026-06-22',
      },
      {
        title: 'Safety Audit — All Sites',
        description: 'Conduct safety compliance audit. Document any violations with photos.',
        project_id: proj2,
        project_name: projects[2]?.title || 'City Hospital Renovation',
        due_date: '2026-07-01',
      },
    ]

    demoTasks.forEach((t) => this.create(t))
  },
}
