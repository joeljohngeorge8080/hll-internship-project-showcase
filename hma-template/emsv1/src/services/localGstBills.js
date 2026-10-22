// localStorage-backed store for the Finance GST Bills module.
// Batches = one Excel upload; entries = the GST=Yes rows it contained.
// Follows the conventions of localGeneralExpenses.js.

const KEYS = {
  batches: 'hma_gst_batches',
  entries: 'hma_gst_entries',
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const now = () => new Date().toISOString()

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}
const write = (key, data) => localStorage.setItem(key, JSON.stringify(data))

export const localGstBills = {
  batches: {
    list: () => read(KEYS.batches),
    create: ({ fileName, uploadedBy, projectId }) => {
      const batch = {
        id: uid(),
        fileName,
        uploadedBy: uploadedBy || '',
        projectId,
        uploadedAt: now(),
      }
      write(KEYS.batches, [...read(KEYS.batches), batch])
      return batch
    },
    remove: (id) => {
      write(
        KEYS.batches,
        read(KEYS.batches).filter((b) => b.id !== id),
      )
      write(
        KEYS.entries,
        read(KEYS.entries).filter((e) => e.batchId !== id),
      )
    },
  },
  entries: {
    list: () => read(KEYS.entries),
    createMany: (batchId, rows, projectId) => {
      const ts = now()
      const created = rows.map((row) => {
        const dept = (row.department || '').trim().toLowerCase()
        const vert = (row.vertical || '').trim().toLowerCase()
        return {
          id: uid(),
          batchId,
          projectId,
          ...row,
          accounted: 'Not Accounted',
          // Admin and CSR bills are ineligible for input tax credit by default
          eligibility:
            dept === 'admin' || dept === 'csr' || vert === 'csr' ? 'Not Eligible' : 'Eligible',
          createdAt: ts,
          updatedAt: ts,
        }
      })
      write(KEYS.entries, [...read(KEYS.entries), ...created])
      return created
    },
    update: (id, patch) => {
      const all = read(KEYS.entries)
      const idx = all.findIndex((e) => e.id === id)
      if (idx === -1) return null
      all[idx] = { ...all[idx], ...patch, updatedAt: now() }
      write(KEYS.entries, all)
      return all[idx]
    },
  },
}

export default localGstBills
