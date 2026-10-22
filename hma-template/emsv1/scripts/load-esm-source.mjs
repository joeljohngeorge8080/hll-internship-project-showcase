// Loads an ESM-syntax source file from src/ into node.
// The package is CJS (no "type": "module"), so src .js files can't be
// imported directly — copy to a temp .mjs and import, then delete.
// The temp file is placed in the SAME directory as the source (not next to
// this script) so the source's own same-directory relative imports (e.g.
// `import { x } from './y.js'`) keep resolving correctly.
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const loadEsmSource = async (relPathFromProjectRoot) => {
  const src = join(here, '..', relPathFromProjectRoot)
  const base = relPathFromProjectRoot.split('/').pop()
  const tmp = join(dirname(src), `.tmp-${Date.now()}-${base}.mjs`)
  copyFileSync(src, tmp)
  try {
    return await import(`file://${tmp}`)
  } finally {
    rmSync(tmp, { force: true })
  }
}
