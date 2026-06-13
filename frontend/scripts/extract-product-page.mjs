import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(
  __dirname,
  '../src/features/landing/pages/ProductPage.tsx'
)
const outDir = path.join(__dirname, '../src/features/landing/product')
fs.mkdirSync(outDir, { recursive: true })

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/)

// Lines 42-151: const cardThemes = [ ... ];
const themesBlock = lines.slice(41, 151).join('\n')
fs.writeFileSync(
  path.join(outDir, 'productCardThemes.ts'),
  themesBlock.replace(/^const cardThemes/, 'export const cardThemes') + '\n'
)

// Lines 153-2318: getFAFeatureSvg
const svgBlock = lines.slice(152, 2318).join('\n')
fs.writeFileSync(
  path.join(outDir, 'getFAFeatureSvg.tsx'),
  `import type { ReactNode } from 'react'\n\nexport ${svgBlock.replace(/^function getFAFeatureSvg/, 'function getFAFeatureSvg')}\n`
)

// types.ts from interface
fs.writeFileSync(
  path.join(outDir, 'types.ts'),
  `export interface FeatureCardProps {
  feature: {
    icon: unknown
    title: string
    description: string
    benefits?: string[]
    subFeatures?: string[]
  }
  i: number
  productId?: string
}
`
)

// Lines 2320-2948: FeatureCard component
const cardBlock = lines.slice(2319, 2948).join('\n')
const cardFile = `import React, { useState } from 'react'
import { Check, Maximize2, X, XCircle } from 'lucide-react'
import { cardThemes } from './productCardThemes'
import { getFAFeatureSvg } from './getFAFeatureSvg'
import { getCRMFeatureSvg } from '../pages/getCRMFeatureSvg'
import type { FeatureCardProps } from './types'

${cardBlock
  .replace(
    'const FeatureCard: React.FC<FeatureCardProps>',
    'export const ProductFeatureCard: React.FC<FeatureCardProps>'
  )
  .replace(/FeatureCard/g, (m, offset, str) => {
    // avoid replacing ProductFeatureCard back
    const before = str.slice(Math.max(0, offset - 20), offset)
    if (before.endsWith('Product')) return m
    if (m === 'FeatureCard') return 'ProductFeatureCard'
    return m
  })}
`
fs.writeFileSync(path.join(outDir, 'ProductFeatureCard.tsx'), cardFile)

console.log('Extracted product modules to', outDir)
