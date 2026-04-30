import { cn } from '@/lib/utils'
import React from 'react'

export const Container = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div className={cn("space-y-7 max-w-[1480px] mx-auto", className)}>
      {children}
    </div>
  )
}