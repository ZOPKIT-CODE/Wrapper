import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendDir, '..')

const hasGit =
  existsSync(join(repoRoot, '.git')) ||
  existsSync(join(frontendDir, '.git'))

if (!hasGit) {
  process.exit(0)
}

try {
  execSync('pnpm exec husky install frontend/.husky', {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  })
} catch {
  process.exit(0)
}
