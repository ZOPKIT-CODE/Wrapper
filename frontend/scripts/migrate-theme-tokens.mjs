/**
 * Replace hardcoded navy/brand hex with shadcn semantic Tailwind utilities.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..', 'src')

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full)
  }
  return files
}

const SKIP_PARTS = [
  'getCRMFeatureSvg.tsx',
  'index.css',
  'invite-accept.css',
  'paymentSuccessConfetti.ts',
  'onboarding/constants.ts',
  'mockPermissions.ts',
  'kindeIntegratedData.ts',
  'crm-role-templates.ts',
]

const REPLACEMENTS = [
  [/text-\[#1b2e5a\]/gi, 'text-primary'],
  [/bg-\[#1b2e5a\]/gi, 'bg-primary'],
  [/border-\[#1b2e5a\]/gi, 'border-primary'],
  [/from-\[#1b2e5a\]/gi, 'from-primary'],
  [/to-\[#1b2e5a\]/gi, 'to-primary'],
  [/via-\[#1b2e5a\]/gi, 'via-primary'],
  [/hover:text-\[#1b2e5a\]/gi, 'hover:text-primary'],
  [/hover:bg-\[#1b2e5a\]/gi, 'hover:bg-primary'],
  [/hover:border-\[#1b2e5a\]/gi, 'hover:border-primary'],
  [/group-hover:text-\[#1b2e5a\]/gi, 'group-hover:text-primary'],
  [/group-hover:bg-\[#1b2e5a\]/gi, 'group-hover:bg-primary'],
  [/group-hover:border-\[#1b2e5a\]/gi, 'group-hover:border-primary'],
  [/bg-\[#1b2e5a\]\/\[0\.015\]/gi, 'bg-primary/[0.015]'],
  [/bg-\[#1b2e5a\]\/\[0\.06\]/gi, 'bg-primary/[0.06]'],
  [/bg-\[#1b2e5a\]\/\[0\.04\]/gi, 'bg-primary/[0.04]'],
  [/border-\[#1b2e5a\]\/8/gi, 'border-primary/8'],
  [/border-\[#1b2e5a\]\/5/gi, 'border-primary/5'],
  [/border-\[#1b2e5a\]\/10/gi, 'border-primary/10'],
  [/border-\[#1b2e5a\]\/20/gi, 'border-primary/20'],
  [/border-\[#1b2e5a\]\/30/gi, 'border-primary/30'],
  [/border-\[#1b2e5a\]\/40/gi, 'border-primary/40'],
  [/bg-\[#1b2e5a\]\/5/gi, 'bg-primary/5'],
  [/bg-\[#1b2e5a\]\/10/gi, 'bg-primary/10'],
  [/text-\[#1b2e5a\]\/50/gi, 'text-primary/50'],
  [/text-\[#1b2e5a\]\/60/gi, 'text-primary/60'],
  [/text-\[#1b2e5a\]\/70/gi, 'text-primary/70'],
  [/text-\[#1b2e5a\]\/90/gi, 'text-primary/90'],
  [/shadow-\[#1b2e5a\]\/15/gi, 'shadow-primary/15'],
  [/shadow-\[#1b2e5a\]\/20/gi, 'shadow-primary/20'],
  [/ring-\[#1b2e5a\]\/20/gi, 'ring-primary/20'],
  [/focus:ring-\[#1b2e5a\]\/10/gi, 'focus:ring-ring/10'],
  [/focus:ring-\[#1b2e5a\]\/20/gi, 'focus:ring-ring/20'],
  [/focus:ring-\[#1b2e5a\]/gi, 'focus:ring-ring'],
  [/focus:border-\[#1b2e5a\]/gi, 'focus:border-ring'],
  [/hover:bg-\[#152449\]/gi, 'hover:bg-primary-hover'],
  [/hover:bg-\[#162447\]/gi, 'hover:bg-primary-hover'],
  [/hover:bg-\[#243a6c\]/gi, 'hover:bg-primary-hover'],
  [/bg-\[#152449\]/gi, 'bg-primary-hover'],
  [/bg-\[#162447\]/gi, 'bg-primary-hover'],
  [/bg-\[#f0f4fa\]/gi, 'bg-muted'],
  [/bg-\[#fafafa\]/gi, 'bg-muted'],
  [/hover:bg-\[#ebebeb\]/gi, 'hover:bg-muted'],
  [/to-\[#243d73\]/gi, 'to-primary-hover'],
  [/to-\[#0f1d3a\]/gi, 'to-primary-hover'],
  [/from-\[#11254d\]/gi, 'from-primary-hover'],
  [/from-\[#0f1f40\]/gi, 'from-primary-hover'],
  [/'#1b2e5a'/gi, "'var(--primary)'"],
  [/"#1b2e5a"/gi, '"var(--primary)"'],
  [/'#9ca3af'/gi, "'var(--muted-foreground)'"],
  [/"#9ca3af"/gi, '"var(--muted-foreground)"'],
  [/hover:border-\[#162447\]/gi, 'hover:border-primary-hover'],
  [/className="bg-primary text-white/gi, 'className="bg-primary text-primary-foreground'],
  [/ring-\[#1b2e5a\]/gi, 'ring-primary'],
  [/border-l-\[#1b2e5a\]/gi, 'border-l-primary'],
  [/divide-\[#1b2e5a\]/gi, 'divide-primary'],
  [/hover:text-\[#243a6c\]/gi, 'hover:text-primary-hover'],
  [/hover:text-\[#162447\]/gi, 'hover:text-primary-hover'],
  [/hover:bg-\[#243b6e\]/gi, 'hover:bg-primary-hover'],
  [/bg-\[#13204a\]/gi, 'bg-primary-hover'],
  [/hover:shadow-\[#1b2e5a\]/gi, 'hover:shadow-primary'],
  [/ring-\[#1b2e5a\]\/40/gi, 'ring-primary/40'],
  [/ring-\[#1b2e5a\]\/10/gi, 'ring-primary/10'],
  [/data-\[active=true\]:text-\[#2a2359\]/gi, 'data-[active=true]:text-primary'],
  [/className='bg-primary text-white/gi, "className='bg-primary text-primary-foreground"],
]

const files = walk(root)

let changed = 0
for (const file of files) {
  const normalized = file.replace(/\\/g, '/')
  if (SKIP_PARTS.some((part) => normalized.includes(part))) continue

  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [pattern, replacement] of REPLACEMENTS) {
    after = after.replace(pattern, replacement)
  }
  if (after !== before) {
    writeFileSync(file, after, 'utf8')
    changed++
    console.log('updated:', path.relative(root, file))
  }
}

console.log(`\nDone. ${changed} files updated.`)
