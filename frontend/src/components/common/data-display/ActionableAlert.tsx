import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui'
import { X } from 'lucide-react'

const alertVariants = cva('border rounded-lg p-4', {
  variants: {
    severity: {
      default: 'border-border bg-muted/50 text-foreground',
      destructive:
        'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-300',
      warning:
        'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
      success:
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
    },
  },
  defaultVariants: {
    severity: 'default',
  },
})

const subtitleVariants = cva('text-sm', {
  variants: {
    severity: {
      default: 'text-muted-foreground',
      destructive: 'text-destructive/90 dark:text-red-300/90',
      warning: 'text-amber-800 dark:text-amber-200/90',
      success: 'text-emerald-800 dark:text-emerald-200/90',
    },
  },
  defaultVariants: {
    severity: 'default',
  },
})

interface ActionableAlertProps extends VariantProps<typeof alertVariants> {
  title: string
  subTitle?: string
  actions: React.ReactNode
  className?: string
  onClose?: () => void
}

export default function ActionableAlert({
  title,
  subTitle,
  actions,
  severity,
  className,
  onClose,
}: ActionableAlertProps) {
  return (
    <Alert className={cn(alertVariants({ severity }), 'relative', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-8">
          <AlertTitle className="mb-1 font-medium">{title}</AlertTitle>

          <AlertDescription className={subtitleVariants({ severity })}>
            {subTitle && (
              <div className={subtitleVariants({ severity })}>{subTitle}</div>
            )}

            {actions && <div className="mt-3 flex gap-2">{actions}</div>}
          </AlertDescription>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  )
}
