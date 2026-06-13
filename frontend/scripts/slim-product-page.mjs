import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../src/features/landing/pages/ProductPage.tsx')
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)

const head = lines
  .slice(0, 28)
  .filter(
    (l) =>
      !l.includes('getCRMFeatureSvg') &&
      !l.includes('interface FeatureCardProps')
  )

const bridgeIdx = head.findIndex((l) =>
  l.includes('productPricingModuleBridge')
)
head.splice(
  bridgeIdx + 1,
  0,
  "import { ProductFeatureCard } from '@/features/landing/product/ProductFeatureCard'"
)

let tail = lines.slice(2949).join('\n')
tail = tail.replace(/<FeatureCard\b/g, '<ProductFeatureCard')
tail = tail.replace(/<\/FeatureCard>/g, '</ProductFeatureCard>')

const out = `${head.join('\n')}\n\n${tail}`
fs.writeFileSync(file, out)
console.log('ProductPage slimmed to', out.split('\n').length, 'lines')
