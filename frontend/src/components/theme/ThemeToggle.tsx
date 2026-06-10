import { Moon, Sun, Monitor, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { setTheme, actualTheme } = useTheme()

  const getThemeIcon = () => {
    switch (actualTheme) {
      case 'monochrome':
        return <Palette className="h-[1.2rem] w-[1.2rem]" />
      case 'dark':
        return <Moon className="h-[1.2rem] w-[1.2rem]" />
      default:
        return <Sun className="h-[1.2rem] w-[1.2rem]" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="border-border/50 hover:bg-accent hover:text-accent-foreground dark:border-border dark:hover:bg-accent dark:hover:text-accent-foreground dark:text-white"
        >
          {getThemeIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('monochrome')}>
          <Palette className="mr-2 h-4 w-4" />
          <span>Monochrome</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SimpleThemeToggle() {
  const { actualTheme, setTheme } = useTheme()

  const getThemeIcon = () => {
    switch (actualTheme) {
      case 'monochrome':
        return <Palette className="h-[1.2rem] w-[1.2rem]" />
      case 'dark':
        return <Moon className="h-[1.2rem] w-[1.2rem]" />
      default:
        return <Sun className="h-[1.2rem] w-[1.2rem]" />
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(actualTheme === 'light' ? 'dark' : 'light')}
      className="border-border/50 hover:bg-accent hover:text-accent-foreground dark:border-border dark:hover:bg-accent dark:hover:text-accent-foreground h-9 w-9"
    >
      {getThemeIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
