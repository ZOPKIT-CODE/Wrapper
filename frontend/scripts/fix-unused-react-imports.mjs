/** Remove unused default React imports (jsx: react-jsx). */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

function runTsc() {
  try {
    return execSync('pnpm exec tsc --noEmit 2>&1', { cwd: root, encoding: 'utf8' })
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

const files = new Set()
for (const line of runTsc().split(/\r?\n/)) {
  const m = line.match(/^(.+?)\(\d+,\d+\): error TS6133: 'React'/)
  if (m) files.add(`${root}/${m[1].replace(/\\/g, '/')}`)
}

let fixed = 0
for (const file of files) {
  let src = readFileSync(file, 'utf8')
  const before = src
  src = src.replace(/^import React from 'react';\r?\n/, '')
  src = src.replace(/^import React from "react";\r?\n/, '')
  src = src.replace(/^import React, /, 'import ')
  if (src !== before) {
    writeFileSync(file, src, 'utf8')
    fixed++
    console.log('fixed:', file.replace(root, ''))
  }
}
console.log(`Done. ${fixed} files.`)
