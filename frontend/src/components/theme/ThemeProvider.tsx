import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'monochrome' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  actualTheme: 'light' | 'dark' | 'monochrome'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

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
  defaultTheme = 'system',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [actualTheme, setActualTheme] = useState<'light' | 'dark' | 'monochrome'>('light')

  useEffect(() => {
    // Load theme from localStorage
    const storedTheme = localStorage.getItem(storageKey) as Theme
    if (storedTheme && ['light', 'dark', 'monochrome', 'system'].includes(storedTheme)) {
      setTheme(storedTheme)
    }
  }, [storageKey])

  useEffect(() => {
    const root = window.document.documentElement

    const updateTheme = () => {
      // Dark mode removed — the app is always light. Ignore stored/system theme
      // and never apply the `dark`/`monochrome` root classes.
      setActualTheme('light')
      root.classList.remove('dark', 'monochrome')
    }

    updateTheme()

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme()
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setThemeCallback = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem(storageKey, newTheme)
  }, [storageKey])

  const value = useMemo(() => ({
    theme,
    setTheme: setThemeCallback,
    actualTheme,
  }), [theme, actualTheme, setThemeCallback])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
