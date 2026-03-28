import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: string
    isPositive: boolean
    label?: string
  }
  description?: string
  className?: string
  iconColor?: string
  loading?: boolean
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  iconColor = "text-[#1B2E5A]",
  loading = false
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
          </div>
          {description && <div className="h-3 bg-gray-200 rounded w-32 mt-2"></div>}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <div className="flex items-center mt-2">
                <Badge 
                  variant={trend.isPositive ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {trend.isPositive ? '+' : ''}{trend.value}
                </Badge>
                {trend.label && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>
          <Icon className={cn("h-8 w-8", iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
} 