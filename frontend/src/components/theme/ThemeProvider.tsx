import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useCallback,
} from 'react'

type Theme = 'light' | 'dark' | 'monochrome' | 'system'

const VALID_THEMES: Theme[] = ['light', 'dark', 'monochrome', 'system']

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === 'undefined') return fallback

  const stored = localStorage.getItem(storageKey) as Theme | null
  if (stored && VALID_THEMES.includes(stored)) return stored

  // Migrate legacy key from older builds
  if (storageKey === 'zopkit-theme') {
    const legacy = localStorage.getItem('theme') as Theme | null
    if (legacy && VALID_THEMES.includes(legacy)) {
      localStorage.setItem(storageKey, legacy)
      localStorage.removeItem('theme')
      return legacy
    }
  }

  return fallback
}

function applyThemeClass(theme: Theme) {
  const root = window.document.documentElement
  let resolvedTheme: 'light' | 'dark' | 'monochrome'

  if (theme === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  } else if (theme === 'monochrome') {
    resolvedTheme = 'monochrome'
  } else {
    resolvedTheme = theme
  }

  root.classList.remove('dark', 'monochrome')
  root.removeAttribute('data-theme')

  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
    root.dataset.theme = 'dark'
  } else if (resolvedTheme === 'monochrome') {
    root.classList.add('monochrome')
    root.dataset.theme = 'monochrome'
  } else {
    root.dataset.theme = 'light'
  }

  return resolvedTheme
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Resolved theme after system preference — for ThemeToggle / Sonner only; use Tailwind dark: in UI. */
  actualTheme: 'light' | 'dark' | 'monochrome'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/** Prefer Tailwind `dark:` / `monochrome:` + CSS variables. Only use in ThemeToggle and Sonner. */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    readStoredTheme(storageKey, defaultTheme)
  )
  const [actualTheme, setActualTheme] = useState<
    'light' | 'dark' | 'monochrome'
  >('light')

  useLayoutEffect(() => {
    setActualTheme(applyThemeClass(theme))
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        setActualTheme(applyThemeClass('system'))
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setThemeCallback = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
      setActualTheme(applyThemeClass(newTheme))
    },
    [storageKey]
  )

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeCallback,
      actualTheme,
    }),
    [theme, actualTheme, setThemeCallback]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
