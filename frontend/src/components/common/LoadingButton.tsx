import { Button, ButtonProps } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ZopkitRoundLoader } from './feedback/ZopkitRoundLoader'

interface IconButtonProps extends ButtonProps {
  startIcon?: LucideIcon
  endIcon?: LucideIcon
  startIconClassName?: string
  endIconClassName?: string
}

export function IconButton({
  children,
  className,
  startIcon: StartIcon,
  endIcon: EndIcon,
  startIconClassName,
  endIconClassName,
  ...props
}: IconButtonProps) {
  return (
    <Button className={cn(className, 'gap-2')} {...props}>
      {StartIcon && <StartIcon className={cn(startIconClassName, 'h-4 w-4')} />}
      {children}
      {EndIcon && <EndIcon className={cn(endIconClassName, 'h-4 w-4')} />}
    </Button>
  )
}

interface LoadingButtonProps extends IconButtonProps {
  isLoading: boolean
  loadingLabel?: string
}

export function LoadingButton({
  isLoading,
  variant = 'outline',
  children,
  startIcon: StartIcon,
  startIconClassName,
  loadingLabel,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      {...props}
      disabled={isLoading}
      className={cn('gap-2', props.className)}
    >
      {isLoading ? (
        <ZopkitRoundLoader size="xs" className="shrink-0" />
      ) : (
        StartIcon && <StartIcon className={cn(startIconClassName, 'h-4 w-4')} />
      )}
      {isLoading && loadingLabel ? loadingLabel : children}
    </Button>
  )
}

export default LoadingButton
