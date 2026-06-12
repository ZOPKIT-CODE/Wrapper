/**
 * One-off helper: replace hardcoded gray/slate classes in onboarding with semantic tokens.
 * Run: node scripts/migrate-onboarding-tokens.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../src/features/onboarding')

const replacements = [
  ['text-[#1B2E5A]', 'text-primary'],
  ['text-[#1b2e5a]', 'text-primary'],
  ['text-slate-900', 'text-foreground'],
  ['text-slate-800', 'text-foreground'],
  ['text-slate-700', 'text-foreground'],
  ['text-slate-600', 'text-muted-foreground'],
  ['text-slate-500', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
  ['text-gray-900', 'text-foreground'],
  ['text-gray-800', 'text-foreground'],
  ['text-gray-700', 'text-foreground'],
  ['text-gray-600', 'text-muted-foreground'],
  ['text-gray-500', 'text-muted-foreground'],
  ['text-gray-400', 'text-muted-foreground'],
  ['bg-slate-50/50', 'bg-muted/50'],
  ['bg-slate-50/30', 'bg-muted/30'],
  ['bg-slate-50/20', 'bg-muted/20'],
  ['bg-slate-50', 'bg-muted'],
  ['bg-slate-100', 'bg-muted'],
  ['bg-gray-50', 'bg-muted'],
  ['bg-gray-100', 'bg-muted'],
  ['border-slate-200/90', 'border-border'],
  ['border-slate-200', 'border-border'],
  ['border-slate-100', 'border-border'],
  ['border-gray-200', 'border-border'],
  ['hover:border-slate-300', 'hover:border-border'],
  ['hover:bg-slate-50', 'hover:bg-muted'],
  ['hover:bg-blue-50', 'hover:bg-primary/5'],
  ['hover:text-blue-950', 'hover:text-primary'],
  ['text-blue-800', 'text-primary'],
]

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p)
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8')
      let changed = false
      for (const [from, to] of replacements) {
        if (content.includes(from)) {
          content = content.split(from).join(to)
          changed = true
        }
      }
      if (changed) {
        fs.writeFileSync(p, content)
        console.log('updated', path.relative(root, p))
      }
    }
  }
}

walk(root)
