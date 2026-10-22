import assert from 'node:assert/strict'
import { loadEsmSource } from './load-esm-source.mjs'

// minimal localStorage shim — must be installed BEFORE the module loads
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { localGstBills } = await loadEsmSource('src/services/localGstBills.js')

assert.deepEqual(localGstBills.batches.list(), [])
assert.deepEqual(localGstBills.entries.list(), [])

const batch = localGstBills.batches.create({ fileName: 'nov.xlsx', uploadedBy: 'Heads User' })
assert.ok(batch.id, 'batch gets an id')
assert.equal(batch.fileName, 'nov.xlsx')
assert.ok(batch.uploadedAt, 'batch gets a timestamp')
assert.equal(localGstBills.batches.list().length, 1)

const created = localGstBills.entries.createMany(batch.id, [
  {
    department: 'HR',
    vertical: 'T',
    partyName: 'Acme',
    gstNo: 'G1',
    invoiceDate: '2025-12-07',
    invoiceNumber: 'INV-1',
    totalValue: 118,
    gstRate: 18,
    cessRate: 0,
    needsAttention: false,
  },
  {
    department: 'Core',
    vertical: '',
    partyName: 'Beta',
    gstNo: 'G2',
    invoiceDate: '',
    invoiceNumber: 'INV-2',
    totalValue: 50,
    gstRate: 5,
    cessRate: 0,
    needsAttention: false,
  },
])
assert.equal(created.length, 2)
assert.equal(created[0].accounted, 'Not Accounted', 'default flag')
assert.equal(created[0].eligibility, 'Eligible', 'default flag')
assert.equal(created[0].batchId, batch.id)
assert.ok(created[0].id && created[0].createdAt && created[0].updatedAt)
assert.equal(localGstBills.entries.list().length, 2)

const updated = localGstBills.entries.update(created[0].id, {
  accounted: 'Accounted',
  totalValue: 120,
})
assert.equal(updated.accounted, 'Accounted')
assert.equal(updated.totalValue, 120)
assert.equal(updated.partyName, 'Acme', 'unpatched fields preserved')
assert.equal(
  localGstBills.entries.list().find((e) => e.id === created[0].id).totalValue,
  120,
  'update persisted',
)
assert.equal(localGstBills.entries.update('no-such-id', {}), null)

// removing a batch removes its entries too
localGstBills.batches.remove(batch.id)
assert.deepEqual(localGstBills.batches.list(), [])
assert.deepEqual(localGstBills.entries.list(), [])

console.log('verify-local-gst-bills: ALL PASS')
