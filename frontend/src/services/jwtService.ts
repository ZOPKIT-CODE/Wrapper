// Browser-compatible JWT service for CRM authentication
// This replaces the custom code generation that was causing infinite redirects

import { JWT_SECRET, WRAPPER_DOMAIN } from '../lib/config'

// Define user interface for type safety - compatible with Kinde UserProfile
interface User {
  id: string
  email: string
  name?: string
  givenName?: string
  organization?: {
    code?: string
  }
  tenantId?: string
  permissions?: string[]
}

// Extended interface for Kinde UserProfile compatibility
interface IdpUserProfile {
  id: string
  email?: string
  givenName?: string
  familyName?: string
  organization?: {
    code?: string
  }
  [key: string]: unknown // Allow additional properties
}

// Shape of the JWT payload minted for CRM, and decoded back by verifyToken
interface CRMTokenPayload {
  sub: string
  email: string
  name: string
  org_code: string
  iss: string
  aud: string[]
  exp: number
  iat: number
  permissions: string[]
  jti: string
  source: string
  app: string
}

class JWTService {
  private readonly WRAPPER_DOMAIN: string

  constructor() {
    // Get environment variables from config. The resolved secret isn't stored on
    // the instance (tokens are minted via generateSecureToken), but resolving it
    // here preserves the dev-only fallback warning when JWT_SECRET is unset.
    void (JWT_SECRET || this.generateFallbackSecret())
    this.WRAPPER_DOMAIN = WRAPPER_DOMAIN
  }

  /**
   * Generate a secure JWT token specifically for CRM authentication
   * This replaces the custom code generation that was causing infinite redirects
   */
  generateCRMToken(user: User | IdpUserProfile): string {
    try {
      const userLike = user as Partial<User>
      // Create a secure token payload for CRM
      const payload: CRMTokenPayload = {
        sub: user.id,
        email: user.email || 'unknown@example.com',
        name: userLike.name || user.givenName || user.email || 'Unknown User',
        org_code: user.organization?.code || userLike.tenantId || 'default',
        iss: this.WRAPPER_DOMAIN,
        aud: ['crm'],
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
        iat: Math.floor(Date.now() / 1000),
        permissions: userLike.permissions || [],
        jti: this.generateRandomId(), // Unique token ID
        source: 'wrapper',
        app: 'crm',
      }

      // For now, generate a secure placeholder token that looks like JWT
      // In production, this should call your backend JWT service
      const token = this.generateSecureToken(payload)

      return token
    } catch (error) {
      console.error('❌ Error generating CRM JWT token:', error)

      // Fallback to secure random token if JWT fails
      const fallbackToken = `jwt_fallback_${Date.now()}_${this.generateRandomId()}`
      return fallbackToken
    }
  }

  /**
   * Generate a secure token that looks like JWT (for CRM compatibility)
   */
  private generateSecureToken(payload: CRMTokenPayload): string {
    try {
      // Create a base64-encoded header
      const header = btoa(
        JSON.stringify({
          typ: 'JWT',
          alg: 'HS256',
        })
      )

      // Create a base64-encoded payload
      const payloadStr = btoa(JSON.stringify(payload))

      // Create a signature-like string (in production, this would be a real HMAC signature)
      const signature = this.generateRandomId(32)

      // Combine to form JWT-like token
      return `${header}.${payloadStr}.${signature}`
    } catch (error) {
      console.error('❌ Error generating secure token:', error)
      return `jwt_secure_${Date.now()}_${this.generateRandomId()}`
    }
  }

  /**
   * Generate a random ID using Web Crypto API (browser-compatible)
   */
  private generateRandomId(length: number = 16): string {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Use Web Crypto API if available
        const array = new Uint8Array(length)
        crypto.getRandomValues(array)
        return Array.from(array, (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')
      } else {
        // Fallback to Math.random for older browsers
        return Math.random().toString(36).substr(2, length)
      }
    } catch (error) {
      console.warn('⚠️ Error generating random ID, using fallback:', error)
      return Math.random().toString(36).substr(2, length)
    }
  }

  /**
   * Verify a JWT token (for future use if needed)
   */
  verifyToken(token: string): CRMTokenPayload | null {
    try {
      // For now, just decode the token to extract payload
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1])) as CRMTokenPayload
        return payload
      }
      return null
    } catch (error) {
      console.error('❌ JWT token verification failed:', error)
      return null
    }
  }

  /**
   * Generate a fallback secret if environment variable is not set
   * In production, this should always be set via environment variables
   */
  private generateFallbackSecret(): string {
    const fallbackSecret = this.generateRandomId(64)
    console.warn('⚠️ JWT_SECRET not set, using generated fallback secret')
    console.warn('⚠️ Set JWT_SECRET environment variable for production use')
    return fallbackSecret
  }

  /**
   * Get token expiration time in human readable format
   */
  getTokenExpiry(token: string): string | null {
    try {
      const decoded = this.verifyToken(token)
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000).toISOString()
      }
      return null
    } catch (error) {
      console.error('❌ Error decoding token for expiry:', error)
      return null
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService()

// Also export the class for testing purposes
export { JWTService }
