/**
 * Remove unused imports reported by TS6133 / TS6192.
 * Import lines only — never mutates destructuring or local declarations.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')

function runTsc() {
  try {
    return execSync('pnpm exec tsc --noEmit 2>&1', { cwd: root, encoding: 'utf8' })
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

function parseImportErrors(output) {
  const errors = []
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS6133|TS6192): (.+)$/)
    if (!m) continue
    const nameMatch = m[5].match(/^'([^']+)'/)
    errors.push({
      file: path.join(root, m[1].replace(/\\/g, '/')),
      line: Number(m[2]),
      code: m[4],
      name: nameMatch?.[1] ?? null,
    })
  }
  return errors
}

function isImportLine(line) {
  return /^\s*import\s/.test(line)
}

function removeNamedImport(line, name) {
  const m = line.match(/^(\s*import\s+(?:type\s+)?\{)([\s\S]*?)(\}\s*from\s+['"][^'"]+['"];?\s*)$/)
  if (!m) return null
  const parts = m[2]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const asMatch = p.match(/^(\w+)(?:\s+as\s+(\w+))?$/)
      if (!asMatch) return true
      const imported = asMatch[2] ?? asMatch[1]
      const original = asMatch[1]
      return imported !== name && original !== name
    })
  if (parts.length === 0) return null
  return `${m[1]} ${parts.join(', ')} ${m[3]}`
}

function fixFile(file, fileErrors) {
  if (!existsSync(file)) return 0
  const lines = readFileSync(file, 'utf8').split('\n')
  let fixed = 0

  for (const err of [...fileErrors].sort((a, b) => b.line - a.line)) {
    const idx = err.line - 1
    if (idx < 0 || idx >= lines.length) continue
    const line = lines[idx]
    if (!isImportLine(line)) continue

    if (err.code === 'TS6192') {
      lines.splice(idx, 1)
      fixed++
      continue
    }

    if (!err.name) continue

    const defaultMatch = line.match(/^(\s*import\s+)(\w+)(\s+from\s+.+)$/)
    if (defaultMatch && defaultMatch[2] === err.name) {
      lines.splice(idx, 1)
      fixed++
      continue
    }

    if (line.includes('{')) {
      const updated = removeNamedImport(line, err.name)
      if (updated === null) {
        lines.splice(idx, 1)
        fixed++
      } else if (updated !== line) {
        lines[idx] = updated
        fixed++
      }
    }
  }

  if (fixed > 0) writeFileSync(file, lines.join('\n'), 'utf8')
  return fixed
}

let total = 0
for (let round = 0; round < 6; round++) {
  const errors = parseImportErrors(runTsc()).filter((e) => {
    const line = readFileSync(e.file, 'utf8').split('\n')[e.line - 1] ?? ''
    return isImportLine(line) || e.code === 'TS6192'
  })
  if (errors.length === 0) break

  const byFile = new Map()
  for (const e of errors) {
    if (!byFile.has(e.file)) byFile.set(e.file, [])
    byFile.get(e.file).push(e)
  }

  let roundFixed = 0
  for (const [file, fileErrors] of byFile) {
    roundFixed += fixFile(file, fileErrors)
  }
  total += roundFixed
  console.log(`Round ${round + 1}: ${errors.length} import errors, fixed ${roundFixed}`)
  if (roundFixed === 0) break
}

console.log(`Done. ${total} import fixes applied.`)
