/**
 * **ONBOARDING EXTERNAL SERVICE**
 * Handles all external integrations for onboarding:
 * - Cognito authentication validation
 * - Cognito user creation
 * - Onboarding completion tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { adminCreateUser } from '../../auth/services/cognito-admin-service.js';
import { verifyCognitoToken } from '../../auth/services/cognito-service.js';
import { OnboardingFileLogger } from '../../../utils/onboarding-file-logger.js';
import Logger from '../../../utils/logger.js';

export class OnboardingExternalService {

  /**
   * 🔐 **EXTRACT AND VALIDATE AUTHENTICATION**
   * Centralized authentication handling
   */
  static async extractAndValidateAuthentication(request: unknown, logger: OnboardingFileLogger | null = null): Promise<{ authenticated: boolean; user: { kindeUserId: string; email?: string; name?: string } | null }> {
    if (!request) {
      return { authenticated: false, user: null };
    }

    try {
      // Extract token from request headers
      const req = request as { headers?: { authorization?: string } };
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, user: null };
      }

      const token = authHeader.substring(7);
      if (!token || token.trim() === '' || token.length < 10) {
        return { authenticated: false, user: null };
      }

      // Verify the token against the shared Cognito pool (Cognito-only). A token
      // that does not validate is treated as unauthenticated.
      const ci = await verifyCognitoToken(token);
      if (!ci?.sub) {
        return { authenticated: false, user: null };
      }
      return {
        authenticated: true,
        user: {
          // KEEP the kindeUserId property name for now (renamed in a later phase); carries the Cognito sub.
          kindeUserId: ci.sub,
          email: ci.email,
          name: ci.name
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'general', 'extractAndValidateAuthentication', 'Authentication validation failed', { error: error.message });
      return { authenticated: false, user: null };
    }
  }

  /**
   * 🏢 **SETUP IDENTITY INTEGRATION**
   * Ensure the admin user exists in Cognito. (Kinde->Cognito migration, P4.)
   *
   * The Wrapper OWNS tenancy/orgs/roles in its own DB (tenants, organization_memberships,
   * userRoleAssignments, ...), so there is no longer any org create / add-user-to-org sync to an
   * external IdP — those Wrapper-DB rows are written natively elsewhere. This function now only
   * ensures the Cognito user exists (so they can sign in) and returns the org-code / externalId /
   * userId / userName that callers persist to the Wrapper DB.
   */
  static async setupKindeIntegration(params: { companyName: string; adminEmail: string; firstName?: string; lastName?: string; subdomain: string; existingUser?: { kindeUserId?: string; name?: string; email?: string } | null }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    const { companyName, adminEmail, firstName, lastName, subdomain, existingUser } = params;
    if (logger) (logger as any).kinde.start('Setting up identity integration', { companyName, adminEmail });

    // Org identifiers are owned by the Wrapper DB — generate them locally (no external IdP sync).
    const externalId = `tenant_${uuidv4()}`;
    const actualOrgCode = `org_${subdomain}_${Date.now()}`;

    // Handle user creation/assignment. Membership lives in organization_memberships /
    // userRoleAssignments (written natively elsewhere), so we no longer add the user to an org here.
    let finalKindeUserId;
    let userName;

    if (existingUser) {
      // Use the already-authenticated user; their Cognito identity already exists.
      finalKindeUserId = existingUser.kindeUserId as string;
      userName = existingUser.name || (existingUser.email && String(existingUser.email).split('@')[0]) || '';
      Logger.log('info', 'general', 'setupKindeIntegration', 'Using authenticated user', { kindeUserId: finalKindeUserId });
    } else {
      // Ensure the admin user exists in Cognito via adminCreateUser, which is
      // idempotent; KEEP the kindeUserId column name for now (renamed in a later phase).
      try {
        const cognitoUser = await adminCreateUser({ email: adminEmail, firstName, lastName });

        finalKindeUserId = cognitoUser.sub;
        userName = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : adminEmail.split('@')[0];

        Logger.log('info', 'general', 'setupKindeIntegration', 'Cognito user ensured', { kindeUserId: finalKindeUserId });
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('warning', 'general', 'setupKindeIntegration', 'Cognito user creation failed, using fallback', { error: error.message });
        finalKindeUserId = `user_${String(adminEmail).replace('@', '_').replace('.', '_')}_${Date.now()}`;
        userName = firstName && lastName ? `${firstName} ${lastName}` : String(adminEmail).split('@')[0];
        Logger.log('info', 'general', 'setupKindeIntegration', 'Using fallback user ID', { kindeUserId: finalKindeUserId });
      }
    }

    return {
      orgCode: actualOrgCode,
      externalId,
      userId: finalKindeUserId as string,
      userName: userName as string
    };
  }

  /**
   * 📊 **TRACK ONBOARDING COMPLETION**
   * Track the completion of onboarding process
   */
  static async trackOnboardingCompletion(params: { tenantId: string; type: string; companyName: string; adminEmail: string; subdomain: string; selectedPlan: string; creditAmount: number }): Promise<void> {
    const { tenantId, type, companyName, adminEmail, subdomain, selectedPlan, creditAmount } = params;
    Logger.log('info', 'general', 'trackOnboardingCompletion', 'Tracking onboarding completion for tenant', { tenantId });

    try {
      const onboardingTrackingService = (await import('./onboarding-tracking-service.js')).default;
      await onboardingTrackingService.trackOnboardingPhase(
        tenantId,
        'trial',
        'completed',
        {
          sessionId: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          eventData: {
            onboardingType: type,
            companyName,
            adminEmail,
            subdomain,
            selectedPlan,
            creditAmount,
            completedAt: new Date().toISOString(),
            source: `unified_${type}_onboarding`,
            version: '2.0'
          },
          completionRate: 100,
          stepNumber: 4,
          totalSteps: 4
        } as any
      );

      Logger.log('info', 'general', 'trackOnboardingCompletion', 'Onboarding completion tracked');
    } catch (err: unknown) {
      const trackingError = err as Error;
      Logger.log('warning', 'general', 'trackOnboardingCompletion', 'Onboarding tracking failed, but onboarding completed', { error: trackingError.message });
      // Don't fail onboarding for tracking issues
    }
  }
}

export default OnboardingExternalService;
