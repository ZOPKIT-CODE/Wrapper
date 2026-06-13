import { useTheme } from '@/components/theme/ThemeProvider'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Sonner needs a theme prop; styling elsewhere uses Tailwind dark: + CSS variables. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { actualTheme } = useTheme()

  return (
    <Sonner
      theme={
        (actualTheme === 'monochrome'
          ? 'light'
          : actualTheme) as ToasterProps['theme']
      }
      className="toaster group"
      position="top-right"
      offset="80px"
      gap={12}
      richColors
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      style={{
        zIndex: 9999,
      }}
      {...props}
    />
  )
}

export { Toaster }
