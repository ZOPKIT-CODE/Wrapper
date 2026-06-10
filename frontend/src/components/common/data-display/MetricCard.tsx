import { Card, CardContent, Skeleton } from "@/components/ui"
import { Flex } from "../Page"
import { Typography } from "../Typography"

export function MetricCard({
    title,
    value,
    icon: Icon,
    trend,
    color,
    isLoading
  }: {
    title: string
    value: string | number
    icon: any
    trend: string
    color: string
    isLoading: boolean
  }) {
    const colorClasses = {
      blue: 'text-primary bg-primary/10',
      sky: 'text-primary bg-primary/10',
      green: 'text-green-600 bg-green-100',
      purple: 'text-purple-600 bg-purple-100',
      yellow: 'text-yellow-600 bg-yellow-100'
    }
  
    if (isLoading) {
      return (
        <Card>
          <CardContent className="p-6">
            <Flex align="center" justify="between" className="h-full">
              <div className="space-y-3 flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
            </Flex>
          </CardContent>
        </Card>
      )
    }
  
    return (
      <Card>
        <CardContent className="p-6">
          <Flex align="center" justify="between" className="h-full">
            <div className="space-y-3 flex-1">
              <Typography variant='lead' className="text-sm font-medium text-gray-600">{title}</Typography>
              <Typography variant='h3' className="text-2xl font-bold text-primary">{value}</Typography>
              <Typography variant='muted' className="text-xs text-gray-500">{trend} from last month</Typography>
            </div>
            <div className={`p-3 rounded-full ${colorClasses[color as keyof typeof colorClasses]} flex-shrink-0`}>
              <Icon className="w-6 h-6" />
            </div>
          </Flex>
        </CardContent>
      </Card>
    )
  }