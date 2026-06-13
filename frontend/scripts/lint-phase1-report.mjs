import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const rules = new Set([
  'no-console',
  'react-refresh/only-export-components',
  'react-hooks/exhaustive-deps',
])

const raw = execSync('pnpm exec eslint . --ext ts,tsx -f json', {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
})

const report = JSON.parse(raw)
const items = []

for (const file of report) {
  const short = file.filePath.replace(/\\/g, '/').replace(/.*\/frontend\//, '')
  for (const m of file.messages) {
    if (rules.has(m.ruleId)) {
      items.push({ file: short, line: m.line, rule: m.ruleId, msg: m.message })
    }
  }
}

items.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
writeFileSync('phase1-lint.json', JSON.stringify(items, null, 2))
console.log(`Phase 1 warnings: ${items.length}`)
for (const i of items) {
  console.log(`${i.line}\t${i.rule}\t${i.file}`)
}
