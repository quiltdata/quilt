#!/usr/bin/env node
/*
 * codegen post-process: drop the unused base-types namespace import.
 *
 * near-operation-file-preset adds `import * as Types from <baseTypesPath>` to
 * every operation file unconditionally. Since codegen v6 pre-resolves (inlines)
 * operation result types instead of emitting `Pick<Types.X>`, operations that
 * reference no base enums/inputs/scalars never use `Types`, leaving a dead
 * import. There is no preset option to make the import conditional, so strip it
 * here. `Types` is only ever referenced as `Types.<member>`, so the namespace is
 * unused iff no `Types.` token remains once the import line is removed.
 *
 * Run as an afterAllFileWrite hook (before eslint/prettier); receives the
 * written file paths as argv.
 */
const fs = require('fs')

const IMPORT_RE = /^import\s+(?:type\s+)?\* as Types from '[^']+';?\r?\n/m

for (const file of process.argv.slice(2)) {
  let src
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (!IMPORT_RE.test(src)) continue
  const withoutImport = src.replace(IMPORT_RE, '')
  if (/\bTypes\./.test(withoutImport)) continue // still used — keep the import
  fs.writeFileSync(file, withoutImport)
}
