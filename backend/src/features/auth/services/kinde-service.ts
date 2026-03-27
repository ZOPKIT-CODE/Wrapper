import axios from 'axios';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { shouldLogVerbose } from '../../../utils/verbose-log.js';

const isProduction = process.env.NODE_ENV === 'production';

export interface AddUserToOrgOptions {
  exclusive?: boolean;
  role_code?: string;
  is_admin?: boolean;
}

type ApiErrorShape = {
  response?: {
    data?: unknown;
    status?: number;
    statusText?: string;
  };
  message?: string;
};

export interface SocialAuthOptions {
  redirectUri?: string;
  state?: string;
  prompt?: string;
  loginHint?: string;
}

export interface LoginUrlOptions {
  state?: string;
  prompt?: string;
  additionalParams?: Record<string, string>;
}

export interface UserInfoNormalized {
  id?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  org_code?: string;
  org_codes?: string[];
  organizations?: unknown[];
  socialProvider?: string;
  hasMultipleOrganizations?: boolean;
}

/**
 * Normalize a decoded JWT payload or Kinde API response into a consistent shape.
 */
function normalizeKindePayload(u: Record<string, unknown>): Record<string, unknown> {
  return {
    id: u.sub || u.id || u.user_id,
    email: u.email || u.preferred_email,
    name: u.name || [u.given_name, u.family_name].filter(Boolean).join(' ') || [u.first_name, u.last_name].filter(Boolean).join(' '),
    given_name: u.given_name || u.first_name,
    family_name: u.family_name || u.last_name,
    picture: u.picture || u.avatar,
    org_code: u.org_code || u.organization_code || u.organization,
    org_codes: (u.org_codes as string[]) || (u.org_code ? [u.org_code] : [])
  };
}

class KindeService {
  baseURL: string;
  oauthClientId: string | undefined;
  oauthClientSecret: string | undefined;
  m2mClientId: string | undefined;
  m2mClientSecret: string | undefined;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor() {
    this.baseURL = process.env.KINDE_DOMAIN || 'https://auth.zopkit.com';
    this.oauthClientId = process.env.KINDE_CLIENT_ID;
    this.oauthClientSecret = process.env.KINDE_CLIENT_SECRET;
    this.m2mClientId = process.env.KINDE_M2M_CLIENT_ID;
    this.m2mClientSecret = process.env.KINDE_M2M_CLIENT_SECRET;

    try {
      this.jwks = createRemoteJWKSet(
        new URL(`${this.baseURL}/.well-known/jwks.json`)
      );
    } catch (err) {
      console.warn('⚠️ Failed to initialize JWKS, will fall back to API-based validation');
    }
    
    if (!isProduction && shouldLogVerbose()) {
      console.log('KindeService init:', { baseURL: this.baseURL, oauth: !!this.oauthClientId, m2m: !!this.m2mClientId, jwks: !!this.jwks });
    }
  }

  private normalizeOrgRole(role: string): string {
    // Kinde role assignment APIs expect role key without "org:" namespace.
    if (!role) return 'member';
    return role.replace(/^org:/i, '');
  }

  private isNotFoundOrAlreadyHandledError(error: ApiErrorShape): boolean {
    const status = error.response?.status;
    if (status === 404 || status === 409) return true;

    const data = error.response?.data;
    const serialized = typeof data === 'string' ? data : JSON.stringify(data || {});
    const msg = `${error.message || ''} ${serialized}`.toLowerCase();
    return msg.includes('already') || msg.includes('not found') || msg.includes('does not exist');
  }

  private async assignUserRoleWithFallbacks(m2mToken: string, orgCode: string, kindeUserId: string, role: string): Promise<Record<string, unknown>> {
    const normalizedRole = this.normalizeOrgRole(role);
    const roleAttempts: Array<{ endpoint: string; body: Record<string, unknown> }> = [
      // Most specific pattern: role key in path.
      {
        endpoint: `${this.baseURL}/api/v1/organizations/${orgCode}/users/${kindeUserId}/roles/${encodeURIComponent(normalizedRole)}`,
        body: {}
      },
      // Common fallback patterns used by management APIs.
      {
        endpoint: `${this.baseURL}/api/v1/organizations/${orgCode}/users/${kindeUserId}/roles`,
        body: { role: normalizedRole }
      },
      {
        endpoint: `${this.baseURL}/api/v1/organizations/${orgCode}/users/${kindeUserId}/roles`,
        body: { role_code: normalizedRole }
      },
      {
        endpoint: `${this.baseURL}/api/v1/organizations/${orgCode}/users/${kindeUserId}/roles`,
        body: { roles: [normalizedRole] }
      }
    ];

    let lastError: ApiErrorShape | null = null;
    for (const attempt of roleAttempts) {
      try {
        const response = await axios.post(attempt.endpoint, attempt.body, {
          headers: {
            'Authorization': `Bearer ${m2mToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        return { success: true, endpoint: attempt.endpoint, responseData: response.data };
      } catch (err: unknown) {
        const apiErr = err as ApiErrorShape;
        lastError = apiErr;
        // Only log individual attempt failures at verbose level — callers surface
        // the final outcome at warn/error level so the console is not flooded.
        if (shouldLogVerbose()) {
          console.warn('⚠️ Role assignment attempt failed:', {
            endpoint: attempt.endpoint,
            body: attempt.body,
            status: apiErr.response?.status
          });
        }
      }
    }

    throw lastError || new Error('Role assignment failed');
  }

  /**
   * Verify JWT using Kinde's JWKS endpoint (RS256 signature verification)
   */
  async verifyJWTSignature(token: string): Promise<JWTPayload | null> {
    if (!this.jwks) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.baseURL,
      });
      return payload;
    } catch (err: unknown) {
      const error = err as Error;
      if (shouldLogVerbose()) console.log('⚠️ JWKS verification failed:', error.message);
      return null;
    }
  }

  /**
   * Get M2M access token for API calls
   */
  async getM2MToken() {
    try {
      if (!this.m2mClientId || !this.m2mClientSecret) {
        throw new Error('M2M credentials not configured');
      }

      // Use the correct Kinde management API audience
      const managementAudience = process.env.KINDE_MANAGEMENT_AUDIENCE || 'https://zopkit.kinde.com/api';
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', this.m2mClientId);
      formData.append('client_secret', this.m2mClientSecret);
      formData.append('audience', managementAudience);

      // Add required scopes for organization management
      // Convert comma-separated scopes to space-separated (OAuth2 standard)
      // FIXED: Added all necessary organization management scopes
      const defaultScopes = 'create:organizations create:organization_users create:organization_user_roles create:organization_user_api_scopes create:organization_user_permissions read:organization_users read:organizations';
      const envScopes = process.env.KINDE_MANAGEMENT_SCOPES;

      const scopesToUse = envScopes && envScopes.trim() ? envScopes : defaultScopes;
      const scopes = scopesToUse.replace(/,/g, ' ');

      if (shouldLogVerbose()) console.log('🔍 Requesting Kinde M2M scopes:', scopes);
      formData.append('scope', scopes);

      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data.access_token) {
        if (shouldLogVerbose()) console.log('✅ M2M token obtained successfully');
        return response.data.access_token;
      } else {
        throw new Error('No access token in response');
      }
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      console.error('❌ Failed to get M2M token:', error.message);
      throw new Error(`M2M authentication failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Decode JWT token without verification (fallback strategy)
   */
  decodeJWT(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (second part)
      const payload = parts[1];
      // Handle URL-safe Base64
      let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.log('⚠️ JWT decode failed:', error.message);
      return null;
    }
  }

  /**
   * Get user info with multiple fallback strategies.
   * Priority: JWKS verification -> user_profile API -> introspect API
   * Insecure local JWT decode is only allowed in non-production environments.
   */
  async getUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    try {
      

      // Strategy 0 (preferred): Verify JWT signature via JWKS and extract claims
      try {
        const payload = await this.verifyJWTSignature(accessToken);
        if (payload) {
          if (shouldLogVerbose()) console.log('getUserInfo: JWKS verified');
          const normalized = normalizeKindePayload(payload as unknown as Record<string, unknown>);
          // Kinde access tokens often lack email claims — fetch from userinfo endpoint
          if (!normalized.email) {
            try {
              const profileResponse = await axios.get(`${this.baseURL}/oauth2/v2/user_profile`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 3000
              });
              if (profileResponse.data?.email) {
                normalized.email = profileResponse.data.email;
              }
            } catch { /* email enrichment is best-effort */ }
          }
          return normalized;
        }
      } catch (jwksErr: unknown) {
        if (shouldLogVerbose()) console.log('⚠️ getUserInfo - JWKS verification failed, trying API endpoints...');
      }

      // Strategy 1: Try user_profile endpoint
      try {
        const response = await axios.get(`${this.baseURL}/oauth2/user_profile`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 5000
        });

        if (shouldLogVerbose()) console.log('getUserInfo: user_profile OK');
        return response.data as Record<string, unknown>;
      } catch (profileErr: unknown) {
        const profileError = profileErr as Error & { response?: { status?: number; statusText?: string; data?: unknown } };
        if (shouldLogVerbose()) {
          console.log(`⚠️ getUserInfo - user_profile failed (${profileError.response?.status}):`, profileError.response?.data || profileError.message);
        }
      }

      // Strategy 2: Try introspect endpoint (requires client credentials)
      try {
        const introspectParams = new URLSearchParams();
        introspectParams.append('token', accessToken);
        
        if (this.oauthClientId && this.oauthClientSecret) {
          introspectParams.append('client_id', this.oauthClientId);
          introspectParams.append('client_secret', this.oauthClientSecret);
        }
        
        const introspectResponse = await axios.post(`${this.baseURL}/oauth2/introspect`, 
          introspectParams.toString(), 
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 5000
          }
        );
        
        if (introspectResponse.data.active) {
          if (shouldLogVerbose()) console.log('✅ getUserInfo - Success via introspect endpoint');
          return normalizeKindePayload(introspectResponse.data as Record<string, unknown>);
        } else {
          if (shouldLogVerbose()) console.log('⚠️ getUserInfo - Token is not active according to introspect');
        }
      } catch (introspectErr: unknown) {
        const introspectError = introspectErr as Error & { response?: { status?: number } };
        if (shouldLogVerbose()) {
          console.log(`⚠️ getUserInfo - introspect failed (${introspectError.response?.status})`);
        }
      }

      // Strategy 3: Local JWT decode — ONLY in non-production as a development convenience.
      // In production, refuse to trust unverified tokens.
      if (!isProduction) {
        try {
          const decoded = this.decodeJWT(accessToken);
          if (decoded) {
            const exp = decoded.exp as number | undefined;
            if (typeof exp === 'number' && exp < Date.now() / 1000) {
              throw new Error('Token has expired');
            }

            console.warn('⚠️ getUserInfo - Using INSECURE JWT decode (development only)');
            return normalizeKindePayload(decoded);
          }
        } catch (decodeErr: unknown) {
          const decodeError = decodeErr as Error;
          if (shouldLogVerbose()) console.log(`⚠️ getUserInfo - JWT decode fallback failed:`, decodeError.message);
        }
      }

      throw new Error('All authentication strategies failed');
      
    } catch (err: unknown) {
      const error = err as Error;
      if (shouldLogVerbose()) console.error('❌ getUserInfo - All strategies failed:', error.message);
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Enhanced user info with organization context.
   * getUserInfo() already returns a normalised shape, so we only add the
   * organisation/socialProvider envelope here.
   */
  async getEnhancedUserInfo(accessToken: string): Promise<UserInfoNormalized & { organizations: unknown[]; socialProvider: string; hasMultipleOrganizations: boolean }> {
    try {
      
      const userInfo = await this.getUserInfo(accessToken);

      const orgCodes = (userInfo.org_codes ?? []) as string[];
      const enhancedInfo = {
        ...(userInfo as unknown as UserInfoNormalized),
        organizations: [] as unknown[],
        socialProvider: 'unknown',
        hasMultipleOrganizations: orgCodes.length > 1
      };

      if (shouldLogVerbose()) console.log('getEnhancedUserInfo OK:', enhancedInfo.id);
      return enhancedInfo;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ getEnhancedUserInfo - Error:', error);
      throw error;
    }
  }

  /**
   * Validate token with multiple strategies
   */
  async validateToken(token: string): Promise<Record<string, unknown>> {
    try {
      if (!token || token.trim() === '') {
        throw new Error('No token provided');
      }

      // Get user info (this handles all the fallback strategies)
      const userInfo = await this.getEnhancedUserInfo(token);

      if (!userInfo || !userInfo.id) {
        throw new Error('Invalid user info returned from token validation');
      }

      const ui = userInfo as UserInfoNormalized & { organizations?: unknown[]; socialProvider?: string; hasMultipleOrganizations?: boolean };
      const userContext = {
        userId: ui.id,
        kindeUserId: ui.id,
        tenantId: ui.org_code,
        email: ui.email,
        name: ui.name,
        given_name: ui.given_name || ui.first_name,
        family_name: ui.family_name || ui.last_name,
        avatar: ui.picture,
        socialProvider: ui.socialProvider,
        organization: ui.org_code ? { id: ui.org_code, name: ui.org_code } : null,
        organizations: ui.organizations ?? [],
        hasMultipleOrganizations: !!ui.hasMultipleOrganizations
      };

      if (shouldLogVerbose()) {
        console.log('✅ validateToken - Success:', {
          userId: userContext.userId,
          email: userContext.email,
          hasOrg: !!userContext.organization
        });
      }
      return userContext as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ validateToken - Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0]
      });

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Token is unauthorized or expired');
      } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error('Invalid token format');
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Unable to connect to authentication service');
      }

      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Refresh an expired access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log('🔄 refreshToken - Starting token refresh...');

      if (!this.oauthClientId || !this.oauthClientSecret) {
        throw new Error('OAuth credentials not configured');
      }

      if (!refreshToken) {
        throw new Error('No refresh token provided');
      }

      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', this.oauthClientId);
      formData.append('client_secret', this.oauthClientSecret);
      formData.append('refresh_token', refreshToken);

      if (shouldLogVerbose()) console.log('🔄 refreshToken - Making refresh request to Kinde...');

      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data.access_token) {
        if (shouldLogVerbose()) console.log('✅ refreshToken - Token refresh successful');
        return {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_in: response.data.expires_in,
          token_type: response.data.token_type
        } as Record<string, unknown>;
      } else {
        throw new Error('No access token in refresh response');
      }
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { error?: string; error_description?: string } } };
      console.error('❌ refreshToken - Refresh failed:', error.response?.data || error.message);

      if (error.response?.data?.error === 'invalid_grant') {
        throw new Error('Refresh token is invalid or expired');
      } else if (error.response?.data?.error === 'invalid_client') {
        throw new Error('OAuth client configuration error');
      }

      throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get user's organizations using M2M API.
   * Note: The Kinde M2M token can list all organisations but cannot filter
   * by user membership, so this returns all organisations.
   */
  async getUserOrganizations(kindeUserId: string): Promise<{ organizations: unknown[]; success: boolean; message?: string; error?: string }> {
    try {
      if (shouldLogVerbose()) console.log(`🔍 getUserOrganizations - Getting organizations for user: ${kindeUserId}`);

      if (!kindeUserId) {
        return { organizations: [], success: true, message: 'No user ID provided' };
      }

      if (!this.m2mClientId || !this.m2mClientSecret) {
        throw new Error('M2M credentials not configured');
      }

      const m2mToken = await this.getM2MToken();

      const response = await axios.get(`${this.baseURL}/api/v1/organizations`, {
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Accept': 'application/json'
        }
      });

      const data = response.data as { organizations?: unknown[]; orgs?: unknown[] };
      if (shouldLogVerbose()) console.log('✅ getUserOrganizations - Success');
      return {
        organizations: data.organizations || data.orgs || [],
        success: true
      };
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      console.error(`❌ getUserOrganizations - Error for user ${kindeUserId}:`, error.response?.data || error.message);
      return {
        organizations: [],
        success: false,
        error: (error.response?.data as { error?: string })?.error || error.message
      };
    }
  }

  /**
   * Add user to organization using M2M API
   */
  async addUserToOrganization(kindeUserId: string, orgCode: string, options: AddUserToOrgOptions = {}): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log(`🔗 addUserToOrganization - Adding user ${kindeUserId} to org ${orgCode}`, options);
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        console.warn('⚠️ addUserToOrganization - No M2M credentials available, using fallback');
        return {
          success: true,
          userId: kindeUserId,
          method: options.exclusive ? 'exclusive_assignment' : 'standard_assignment',
          message: 'User added to organization successfully (fallback mode)'
        };
      }
   
      //get the m2m kinde token first 
      const m2mToken = await this.getM2MToken();
      if (shouldLogVerbose()) console.log(`🔑 M2M token obtained: ${m2mToken ? 'Yes' : 'No'}`);

      if (options.exclusive) {
        if (shouldLogVerbose()) {
          console.warn('⚠️ addUserToOrganization - Exclusive cleanup skipped to avoid removing user from unrelated orgs.');
        }
      }

      const role = this.normalizeOrgRole(options.role_code ?? (options.is_admin ? 'admin' : 'member'));
      const roleResult = await this.assignUserRoleWithFallbacks(m2mToken, orgCode, kindeUserId, role);
      if (shouldLogVerbose()) console.log(`✅ addUserToOrganization - Success with role ${role}`);

      return {
        success: true,
        userId: kindeUserId,
        organizationCode: orgCode,
        role: role,
        method: options.exclusive ? 'exclusive_assignment' : 'standard_assignment',
        message: 'User added to organization successfully',
        endpoint: roleResult.endpoint,
        responseData: roleResult.responseData
      };
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: unknown; status?: number; statusText?: string }; stack?: string };
      console.error(`❌ addUserToOrganization - Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        stack: error.stack
      });
      return {
        success: false,
        error: (error.response?.data as { error?: string })?.error || error.message,
        message: 'Failed to add user to organization',
        details: {
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        }
      };
    }
  }

  /**
   * Remove user from organization using M2M API
   */
  async removeUserFromOrganization(kindeUserId: string, orgCode: string): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log(`🗑️ removeUserFromOrganization - Removing user ${kindeUserId} from org ${orgCode}`);
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        console.warn('⚠️ removeUserFromOrganization - No M2M credentials available, using fallback');
        return {
          success: true,
          message: 'User removed from organization successfully (fallback mode)'
        };
      }

      const m2mToken = await this.getM2MToken();
      
      // Remove user from organization via Kinde API
      await axios.delete(`${this.baseURL}/api/v1/organizations/${orgCode}/users/${kindeUserId}`, {
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Accept': 'application/json'
        }
      });

      if (shouldLogVerbose()) console.log('✅ removeUserFromOrganization - Success via Kinde API');
      return {
        success: true,
        message: 'User removed from organization successfully'
      };
    } catch (err: unknown) {
      const error = err as ApiErrorShape;
      const shouldIgnore = this.isNotFoundOrAlreadyHandledError(error);
      if (shouldIgnore) {
        if (shouldLogVerbose()) {
          console.warn('⚠️ removeUserFromOrganization - User not in org (treated as success):', {
            orgCode,
            userId: kindeUserId
          });
        }
        return {
          success: true,
          message: 'User was not a member of organization'
        };
      }
      console.error(`❌ removeUserFromOrganization - Error:`, err);
      return {
        success: false,
        error: error.message || 'Unknown error',
        message: 'Failed to remove user from organization'
      };
    }
  }

  /**
   * Create a new organization in Kinde using M2M API
   */
  async createOrganization(organizationData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log('🏢 createOrganization - Creating organization:', organizationData);
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        throw new Error('M2M credentials not configured – cannot create organization');
      }

      const m2mToken = await this.getM2MToken();
      
      // Prepare organization data according to Kinde API spec
      // FIXED: Use exact format from Kinde API documentation
      const orgPayload = {
        name: organizationData.name || organizationData.companyName,
        external_id: organizationData.external_id || organizationData.subdomain,
        feature_flags: organizationData.feature_flags || {},
        is_allow_registrations: organizationData.is_allow_registrations !== undefined ? organizationData.is_allow_registrations : false,
        is_create_billing_customer: organizationData.is_create_billing_customer !== undefined ? organizationData.is_create_billing_customer : false
      };

      if (organizationData.handle !== undefined) (orgPayload as Record<string, unknown>).handle = organizationData.handle;
      if (organizationData.sender_name !== undefined) (orgPayload as Record<string, unknown>).sender_name = organizationData.sender_name;
      if (organizationData.sender_email !== undefined) (orgPayload as Record<string, unknown>).sender_email = organizationData.sender_email;
      if (organizationData.billing_email !== undefined) (orgPayload as Record<string, unknown>).billing_email = organizationData.billing_email;
      if (organizationData.billing_plan_code !== undefined) (orgPayload as Record<string, unknown>).billing_plan_code = organizationData.billing_plan_code;

      if (shouldLogVerbose()) console.log('📤 createOrganization - Sending payload:', orgPayload);

      const endpoint = `${this.baseURL}/api/v1/organization`;
      
      const response = await axios.post(endpoint, orgPayload, {
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (shouldLogVerbose()) console.log('✅ createOrganization - Success via Kinde API');
      
      // Extract organization code from response
      const orgCode = response.data.organization?.code || response.data.code;
      
      return {
        success: true,
        organization: {
          code: orgCode,
          name: orgPayload.name,
          external_id: orgPayload.external_id,
          is_default: false,
          created_with_fallback: false
        },
        organizationCode: orgCode,
        organizationName: orgPayload.name,
        externalId: orgPayload.external_id,
        isDefault: false,
        created_with_fallback: false,
        message: 'Organization created successfully via Kinde API'
      };
    } catch (err: unknown) {
      const error = err as Error & { response?: { status?: number; statusText?: string; data?: unknown; headers?: unknown }; config?: { url?: string; method?: string } };
      console.error('❌ createOrganization - Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        url: error.config?.url,
        method: error.config?.method
      });
      throw new Error(`Failed to create organization via Kinde API: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    }
  }

  /**
   * Create a new user in Kinde using M2M API
   */
  async createUser(userData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log('👤 createUser - Creating user');
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        throw new Error('M2M credentials not configured – cannot create user');
      }

      const m2mToken = await this.getM2MToken();
      
      // Create user via Kinde API
      const response = await axios.post(`${this.baseURL}/api/v1/users`, {
        profile: {
          given_name: userData.givenName || userData.given_name,
          family_name: userData.familyName || userData.family_name
        },
        identities: [{
          type: 'email',
          details: {
            email: userData.email
          }
        }],
        organization_code: userData.organizationCode || userData.organization_code
      }, {
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (shouldLogVerbose()) console.log('✅ createUser - Success via Kinde API');
      return {
        ...(response.data as Record<string, unknown>),
        created_with_fallback: false,
        message: 'User created successfully via Kinde API'
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ createUser - Error:', error);
      throw new Error(`Failed to create user via Kinde API: ${error.message}`);
    }
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   * Kinde docs: POST /oauth2/token with grant_type=authorization_code
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log('🔄 exchangeCodeForTokens - Exchanging code for tokens');

      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      if (this.oauthClientId) formData.append('client_id', this.oauthClientId);
      if (this.oauthClientSecret) formData.append('client_secret', this.oauthClientSecret);
      formData.append('code', code);
      formData.append('redirect_uri', redirectUri);

      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        formData.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (shouldLogVerbose()) console.log('✅ exchangeCodeForTokens - Success');
      return response.data as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ exchangeCodeForTokens - Error:', error);
      throw new Error('Failed to exchange code for tokens');
    }
  }

  /**
   * Build a Kinde /oauth2/auth URL.
   *
   * Per Kinde docs the supported params are: client_id, redirect_uri,
   * response_type, scope, state, prompt, login_hint, org_code, connection_id,
   * audience, nonce, etc.
   *
   * If a connection_id environment variable exists for the provider
   * (KINDE_CONNECTION_<PROVIDER>), it is included so custom sign-in pages
   * can skip the provider selector.  Otherwise Kinde shows its default
   * sign-in screen with all enabled social connections.
   */
  getSocialAuthUrl(provider: string, options: SocialAuthOptions = {}): string {
    const {
      redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`,
      state = 'default',
      prompt = 'select_account',
      loginHint = '',
    } = options;

    const baseUrl = `${this.baseURL}/oauth2/auth`;
    const paramsObj: Record<string, string> = {
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email offline',
      state,
      prompt,
      ...(this.oauthClientId ? { client_id: this.oauthClientId } : {}),
      ...(loginHint ? { login_hint: loginHint } : {}),
    };

    const connectionEnvKey = `KINDE_CONNECTION_${provider.toUpperCase()}`;
    const connectionId = process.env[connectionEnvKey];
    if (connectionId) {
      paramsObj.connection_id = connectionId;
    }

    return `${baseUrl}?${new URLSearchParams(paramsObj).toString()}`;
  }

  /**
   * Generate login URL for organization-specific authentication.
   * Uses Kinde's org_code parameter to scope the session.
   */
  generateLoginUrl(orgCode: string, redirectUri: string, options: LoginUrlOptions = {}): string {
    try {
      if (shouldLogVerbose()) console.log(`🔗 generateLoginUrl - Generating login URL for org: ${orgCode}`);

      const {
        state = 'onboarding_complete',
        prompt = 'select_account',
        additionalParams = {}
      } = options;

      const baseUrl = `${this.baseURL}/oauth2/auth`;
      const paramsObj: Record<string, string> = {
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email offline',
        state: state,
        prompt: prompt,
        org_code: orgCode,
        ...(this.oauthClientId ? { client_id: this.oauthClientId } : {}),
        ...additionalParams
      };
      const params = new URLSearchParams(paramsObj);

      const loginUrl = `${baseUrl}?${params.toString()}`;
      if (shouldLogVerbose()) console.log(`✅ generateLoginUrl - Generated URL: ${loginUrl.substring(0, 100)}...`);

      return loginUrl;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ generateLoginUrl - Error:', error);
      throw new Error('Failed to generate login URL');
    }
  }

  /**
   * Get organization details using M2M API
   */
  async getOrganizationDetails(orgCode: string): Promise<Record<string, unknown>> {
    try {
      if (shouldLogVerbose()) console.log(`🔍 getOrganizationDetails - Getting details for org: ${orgCode}`);
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        console.warn('⚠️ getOrganizationDetails - No M2M credentials available, using fallback');
        return {
          success: true,
          organization: {
            code: orgCode,
            name: orgCode,
            is_default: false,
            created_with_fallback: true
          }
        };
      }

      const m2mToken = await this.getM2MToken();
      
      const response = await axios.get(`${this.baseURL}/api/v1/organizations/${orgCode}`, {
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Accept': 'application/json'
        }
      });

      if (shouldLogVerbose()) console.log('✅ getOrganizationDetails - Success via Kinde API');
      return {
        success: true,
        organization: response.data
      } as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ getOrganizationDetails - Error:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to get organization details'
      };
    }
  }

  /**
   * List all users using M2M API
   */
  async listUsers(limit = 100, offset = 0, organizationCode: string | null = null): Promise<{ users: unknown[]; success: boolean; error?: string }> {
    try {
      if (shouldLogVerbose()) console.log('🔍 listUsers - Getting all users');
      
      if (!this.m2mClientId || !this.m2mClientSecret) {
        console.warn('⚠️ listUsers - No M2M credentials available, using fallback');
        return {
          users: [],
          success: true
        };
      }

      const m2mToken = await this.getM2MToken();
      
      const params: Record<string, number | string> = { limit, offset };
      if (organizationCode) {
        params.organization_code = organizationCode;
      }
      
      const response = await axios.get(`${this.baseURL}/api/v1/users`, {
        params,
        headers: {
          'Authorization': `Bearer ${m2mToken}`,
          'Accept': 'application/json'
        }
      });

      const data = response.data as { users?: unknown[] };
      return {
        users: data.users || [],
        success: true
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ listUsers - Error:', error);
      return {
        users: [],
        success: false,
        error: error.message
      };
    }
  }
}

// Create a singleton instance
const kindeService = new KindeService();

export default kindeService;
export { KindeService };