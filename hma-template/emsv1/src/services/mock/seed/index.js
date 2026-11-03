// Assembles the full in-memory database the mock client serves. Bump
// SEED_VERSION whenever seed shapes change so stale persisted copies in
// visitors' browsers are discarded and rebuilt.
import { buildPeople } from './people'
import { buildProjects } from './projects'
import { buildOperations } from './operations'

export const SEED_VERSION = 1

export const buildSeed = () => ({
  ...buildPeople(),
  ...buildProjects(),
  ...buildOperations(),
})
