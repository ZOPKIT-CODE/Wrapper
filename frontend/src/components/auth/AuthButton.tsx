import React from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { Button } from '../ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { logger } from '@/lib/logger'

// The auth user carries profile fields via an index signature, so they arrive typed
// as `unknown`. Narrow them to strings for rendering without changing runtime behavior.
const asStr = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

interface AuthButtonProps {
  provider?: 'google' | 'github' | 'microsoft' | 'apple' | 'linkedin'
  orgCode?: string
  size?: 'sm' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showDropdown?: boolean
  redirectUri?: string
  isCreateOrg?: boolean // Add this prop for organization creation
}

const providerConfig = {
  google: {
    icon: '🔍',
    name: 'Google',
    className: 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300',
  },
  github: {
    icon: '🐙',
    name: 'GitHub',
    className: 'bg-gray-900 hover:bg-gray-800 text-white',
  },
  microsoft: {
    icon: '🪟',
    name: 'Microsoft',
    className: 'bg-[#1B2E5A] hover:bg-[#152449] text-white',
  },
  apple: {
    icon: '🍎',
    name: 'Apple',
    className: 'bg-black hover:bg-gray-900 text-white',
  },
  linkedin: {
    icon: '💼',
    name: 'LinkedIn',
    className: 'bg-[#1B2E5A] hover:bg-[#152449] text-white',
  },
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  provider = 'google',
  orgCode,
  size = 'sm',
  variant = 'default',
  showDropdown = true,
  redirectUri,
  isCreateOrg = false, // Add default value
}) => {
  const { login, logout, isAuthenticated, isLoading, user } = useAuth()

  const config = providerConfig[provider]

  // Use provided organization code - no auto-detection
  const finalOrgCode = orgCode

  const handleLogin = () => {
    // Cognito: pass the provider straight through to federate (skips the hosted-UI selector).
    const loginOptions: any = { provider }

    // Add organization creation flag if specified
    if (isCreateOrg) {
      loginOptions.isCreateOrg = true
      logger.debug('🏢 AuthButton: Enabling organization creation during login')
    }

    // Add organization context if available
    if (finalOrgCode) {
      loginOptions.org_code = finalOrgCode
      logger.debug(
        '🏢 AuthButton: Using organization code for login:',
        finalOrgCode
      )
    }

    // Add custom redirect URI if provided
    if (redirectUri) {
      loginOptions.app_state = {
        redirectTo: redirectUri,
      }
    }

    login(loginOptions)
  }

  const handleLogout = () => {
    logout()
  }

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
        <span className="ml-2">Loading...</span>
      </Button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Button
        onClick={handleLogin}
        variant={variant}
        size={size}
        className={variant === 'default' ? config.className : ''}
      >
        <span className="mr-2 text-lg">{config.icon}</span>
        Sign in with {config.name}
      </Button>
    )
  }

  // Authenticated state
  if (!showDropdown) {
    return (
      <div className="flex items-center space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={asStr(user?.picture) || ''}
            alt={asStr(user?.givenName) || 'User'}
          />
          <AvatarFallback>
            {asStr(user?.givenName)?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            Welcome, {asStr(user?.givenName) || user?.email}!
          </span>
        </div>
        <Button onClick={handleLogout} variant="outline" size="sm">
          <LogOut className="mr-1 h-4 w-4" />
          Logout
        </Button>
      </div>
    )
  }

  // Dropdown menu for authenticated user
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={asStr(user?.picture) || ''}
              alt={asStr(user?.givenName) || 'User'}
            />
            <AvatarFallback>
              {asStr(user?.givenName)?.charAt(0) ||
                user?.email?.charAt(0) ||
                'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">
              {asStr(user?.givenName) || user?.email}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>
              {asStr(user?.givenName)} {asStr(user?.familyName)}
            </span>
            <span className="text-xs text-gray-500">{user?.email}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Account Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default AuthButton
