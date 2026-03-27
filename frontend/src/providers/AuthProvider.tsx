import React, { createContext, useContext } from "react"
import { useAuthStore } from "@/stores/authStore"

interface AuthContextType {
  user: any | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: any) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authState = useAuthStore()

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  )
}
