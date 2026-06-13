import type { LucideIcon } from 'lucide-react'

export interface FeatureCardProps {
  feature: {
    icon: LucideIcon
    title: string
    description: string
    benefits?: string[]
    subFeatures?: string[]
  }
  i: number
  productId?: string
}
