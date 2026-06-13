import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SKIP = new Set([
  'src/lib/logger.ts',
  'src/features/onboarding/utils/onboardingLogger.ts',
  'src/main.tsx',
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

let changed = 0
for (const file of walk('src')) {
  const norm = file.replace(/^\.\//, '')
  if (SKIP.has(norm)) continue

  let src = readFileSync(file, 'utf8')
  if (!/console\.(warn|log|info|debug)\(/.test(src)) continue

  let next = src
    .replace(/\bconsole\.warn\(/g, 'logger.warn(')
    .replace(/\bconsole\.log\(/g, 'logger.debug(')
    .replace(/\bconsole\.info\(/g, 'logger.info(')
    .replace(/\bconsole\.debug\(/g, 'logger.debug(')

  if (next === src) continue

  if (!next.includes("from '@/lib/logger'") && !next.includes('from "@/lib/logger"')) {
    const firstImport = next.match(/^import .+$/m)
    if (firstImport) {
      const insertAt = next.indexOf(firstImport[0]) + firstImport[0].length
      next =
        next.slice(0, insertAt) +
        "\nimport { logger } from '@/lib/logger'" +
        next.slice(insertAt)
    } else {
      next = "import { logger } from '@/lib/logger'\n" + next
    }
  }

  writeFileSync(file, next)
  changed++
  console.log('updated', norm)
}

console.log(`\n${changed} files updated`)
