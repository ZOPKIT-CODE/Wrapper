import React from 'react'
import { RefreshCw, AlertCircle, FileX, Wifi, WifiOff } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ZopkitRoundLoader } from './ZopkitRoundLoader'

// ============================================================================
// LOADING STATES (use ZopkitRoundLoader everywhere)
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  return (
    <ZopkitRoundLoader
      size={size as 'xs' | 'sm' | 'md' | 'lg' | 'xl'}
      className={className}
    />
  )
}

interface PageLoadingProps {
  message?: string
  showBackground?: boolean
  className?: string
}

export function PageLoading({
  message = 'Loading...',
  showBackground = true,
  className,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        showBackground ? 'bg-background min-h-screen' : 'min-h-[400px]',
        className
      )}
    >
      <div className="flex flex-col items-center text-center">
        <ZopkitRoundLoader size="page" className="mb-4" />
        <p className="text-muted-foreground mt-2">{message}</p>
      </div>
    </div>
  )
}

interface CardLoadingProps {
  title?: string
  description?: string
  showHeader?: boolean
  className?: string
}

export function CardLoading({
  title,
  description,
  showHeader = true,
  className,
}: CardLoadingProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

interface InlineLoadingProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function InlineLoading({
  message = 'Loading...',
  size = 'md',
  className,
}: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LoadingSpinner size={size} />
      <span className="text-muted-foreground text-sm">{message}</span>
    </div>
  )
}

// ============================================================================
// ERROR STATES
// ============================================================================

interface PageErrorProps {
  error?: Error | string | null
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  showBackground?: boolean
  className?: string
}

export function PageError({
  error,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  showBackground = true,
  className,
}: PageErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        showBackground ? 'bg-background min-h-screen' : 'min-h-[400px]',
        className
      )}
    >
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="border-destructive/20 bg-destructive/5 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md border">
          <AlertCircle className="text-destructive h-7 w-7" />
        </div>
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mb-4 text-sm">{description}</p>
        {errorMessage && (
          <div className="bg-destructive/5 border-destructive/20 mb-4 rounded-md border p-3">
            <p className="text-destructive text-sm">{errorMessage}</p>
          </div>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

interface CardErrorProps {
  error?: Error | string | null
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  showHeader?: boolean
  className?: string
}

export function CardError({
  error,
  title = 'Failed to load data',
  description = 'There was an error loading the data.',
  onRetry,
  retryLabel = 'Retry',
  showHeader = true,
  className,
}: CardErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              {retryLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface InlineErrorProps {
  error?: Error | string | null
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function InlineError({
  error,
  onRetry,
  retryLabel = 'Retry',
  className,
}: InlineErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message

  return (
    <div className={cn('flex items-center gap-2 text-red-600', className)}>
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm">{errorMessage || 'An error occurred'}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm">
          <RefreshCw className="mr-1 h-3 w-3" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// EMPTY STATES
// ============================================================================

interface PageEmptyProps {
  title?: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  showBackground?: boolean
  className?: string
}

export function PageEmpty({
  title = 'No data available',
  description = 'There is no data to display at the moment.',
  icon: Icon = FileX,
  action,
  showBackground = true,
  className,
}: PageEmptyProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        showBackground ? 'bg-background min-h-screen' : 'min-h-[400px]',
        className
      )}
    >
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="border-border bg-secondary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md border">
          <Icon className="text-muted-foreground h-7 w-7" />
        </div>
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mb-4 text-sm">{description}</p>
        {action}
      </div>
    </div>
  )
}

interface CardEmptyProps {
  title?: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  showHeader?: boolean
  className?: string
}

export function CardEmpty({
  title = 'No data available',
  description = 'Data will appear here once available.',
  icon: Icon = FileX,
  action,
  showHeader = true,
  className,
}: CardEmptyProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="border-border bg-secondary mb-4 flex h-12 w-12 items-center justify-center rounded-md border">
            <Icon className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-medium">{title}</h3>
          <p className="text-muted-foreground mb-4 max-w-sm text-sm">
            {description}
          </p>
          {action}
        </div>
      </CardContent>
    </Card>
  )
}

interface InlineEmptyProps {
  message?: string
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}

export function InlineEmpty({
  message = 'No data available',
  icon: Icon = FileX,
  className,
}: InlineEmptyProps) {
  return (
    <div
      className={cn('text-muted-foreground flex items-center gap-2', className)}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

// ============================================================================
// CONNECTIVITY STATES
// ============================================================================

interface ConnectivityErrorProps {
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ConnectivityError({
  onRetry,
  retryLabel = 'Check Connection',
  className,
}: ConnectivityErrorProps) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] items-center justify-center',
        className
      )}
    >
      <div className="text-center">
        <WifiOff className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h3 className="mb-2 text-lg font-semibold">Connection Error</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Unable to connect to the server. Please check your internet
          connection.
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <Wifi className="mr-2 h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// LOADING OVERLAYS
// ============================================================================

interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  message?: string
  className?: string
}

export function LoadingOverlay({
  isLoading,
  children,
  message = 'Loading...',
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="bg-background/80 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <ZopkitRoundLoader size="xl" className="mb-2" />
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

interface SkeletonCardProps {
  showHeader?: boolean
  lines?: number
  className?: string
}

export function SkeletonCard({
  showHeader = true,
  lines = 3,
  className,
}: SkeletonCardProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface SkeletonListProps {
  items?: number
  className?: string
}

export function SkeletonList({ items = 5, className }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-4 gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
