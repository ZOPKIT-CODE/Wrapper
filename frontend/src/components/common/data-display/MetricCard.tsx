import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, Skeleton } from '@/components/ui'
import { Flex } from '../Page'
import { Typography } from '../Typography'

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
  isLoading,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  trend: string
  color: string
  isLoading: boolean
}) {
  const colorClasses = {
    blue: 'text-[#1B2E5A] bg-[#1B2E5A]/10',
    sky: 'text-[#1B2E5A] bg-[#1B2E5A]/10',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    yellow: 'text-yellow-600 bg-yellow-100',
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Flex align="center" justify="between" className="h-full">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
          </Flex>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <Flex align="center" justify="between" className="h-full">
          <div className="flex-1 space-y-3">
            <Typography
              variant="lead"
              className="text-sm font-medium text-gray-600"
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              className="text-2xl font-bold text-[#1B2E5A]"
            >
              {value}
            </Typography>
            <Typography variant="muted" className="text-xs text-gray-500">
              {trend} from last month
            </Typography>
          </div>
          <div
            className={`rounded-full p-3 ${colorClasses[color as keyof typeof colorClasses]} flex-shrink-0`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </Flex>
      </CardContent>
    </Card>
  )
}
