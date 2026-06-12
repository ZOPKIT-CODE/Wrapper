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
    blue: 'text-primary bg-primary/10',
    sky: 'text-primary bg-primary/10',
    green:
      'text-emerald-600 bg-emerald-500/15 dark:text-emerald-300 dark:bg-emerald-500/20',
    purple:
      'text-purple-600 bg-purple-500/15 dark:text-purple-300 dark:bg-purple-500/20',
    yellow:
      'text-amber-600 bg-amber-500/15 dark:text-amber-300 dark:bg-amber-500/20',
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
              className="text-muted-foreground text-sm font-medium"
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              className="text-foreground text-2xl font-bold"
            >
              {value}
            </Typography>
            <Typography
              variant="muted"
              className="text-muted-foreground text-xs"
            >
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
