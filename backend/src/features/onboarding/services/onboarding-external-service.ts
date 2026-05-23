/**
 * **ONBOARDING EXTERNAL SERVICE**
 * Handles all external integrations for onboarding:
 * - Kinde authentication validation
 * - Kinde organization/user creation
 * - Onboarding completion tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { kindeService } from '../../../features/auth/index.js';
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

      // Validate token with Kinde
      const user = await kindeService.validateToken(token);

      const u = user as Record<string, unknown>;
      return {
        authenticated: true,
        user: {
          kindeUserId: (u.kindeUserId || u.userId) as string,
          email: u.email as string | undefined,
          name: (u.name || u.given_name) as string | undefined
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('warning', 'general', 'extractAndValidateAuthentication', 'Authentication validation failed', { error: error.message });
      return { authenticated: false, user: null };
    }
  }

  /**
   * 🏢 **SETUP KINDE INTEGRATION**
   * Create organization and user in Kinde
   */
  static async setupKindeIntegration(params: { companyName: string; adminEmail: string; firstName?: string; lastName?: string; subdomain: string; existingUser?: { kindeUserId?: string; name?: string; email?: string } | null }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    const { companyName, adminEmail, firstName, lastName, subdomain, existingUser } = params;
    if (logger) (logger as any).kinde.start('Setting up Kinde integration', { companyName, adminEmail });

    // Create Kinde organization with fallback
    let kindeOrg: Record<string, unknown>;
    let actualOrgCode: string;
    let orgCreatedWithFallback = false;
    const externalId = `tenant_${uuidv4()}`;

    try {
      if (logger) logger.kinde.start('Creating Kinde organization', { companyName, externalId });

      kindeOrg = await kindeService.createOrganization({
        name: companyName,
        external_id: externalId,
        feature_flags: {
          theme: {
            button_text_color: '#ffffff'
          }
        }
      });

      // Store the actual Kinde organization code and external_id
      const kindeOrgObj = kindeOrg as Record<string, unknown> & { organization?: { code?: string; external_id?: string }; code?: string };
      actualOrgCode = (kindeOrgObj?.organization?.code || kindeOrgObj?.code || '') as string;
      const kindeExternalId = (kindeOrgObj?.organization?.external_id || externalId) as string;

      if (!actualOrgCode) {
        if (logger) (logger as any).kinde.error('Kinde response missing organization code', null, { kindeOrg });
        throw new Error('Failed to get organization code from Kinde response');
      }

      if (logger) (logger as any).kinde.success('Kinde organization created', {
        orgCode: actualOrgCode,
        externalId: kindeExternalId
      });
    } catch (err: unknown) {
      const kindeError = err as Error & { response?: { status?: number; data?: unknown }; code?: string };
      if (logger) (logger as any).kinde.error('Kinde organization creation failed', kindeError, {
        status: kindeError.response?.status,
        data: kindeError.response?.data
      });

      // Use fallback organization code
      actualOrgCode = `org_${subdomain}_${Date.now()}`;
      orgCreatedWithFallback = true;
      kindeOrg = {
        organization: { code: actualOrgCode, name: companyName, external_id: externalId as string },
        created_with_fallback: true
      };
      if (logger) (logger as any).kinde.warning('Using fallback organization code', { orgCode: actualOrgCode });
    }

    // Handle user creation/assignment
    let finalKindeUserId;
    let userName;

    if (existingUser) {
      // Use existing authenticated user and add them to the new organization
      finalKindeUserId = existingUser.kindeUserId as string;
      userName = existingUser.name || (existingUser.email && String(existingUser.email).split('@')[0]) || '';
      Logger.log('info', 'general', 'setupKindeIntegration', 'Using authenticated user', { kindeUserId: finalKindeUserId });

      // Add the existing user to the newly created organization
      try {
        Logger.log('info', 'general', 'setupKindeIntegration', 'Adding existing user to organization', { kindeUserId: finalKindeUserId, orgCode: actualOrgCode });

        // Only try to add if organization was actually created in Kinde (not fallback)
        if (!orgCreatedWithFallback) {
          const addResult = await kindeService.addUserToOrganization(finalKindeUserId, actualOrgCode, { skipRoleAssignment: true });

          if (addResult?.success) {
            Logger.log('info', 'general', 'setupKindeIntegration', 'User successfully added to Kinde organization');
          } else {
            Logger.log('warning', 'general', 'setupKindeIntegration', 'addUserToOrganization returned non-success (non-fatal, onboarding continues)', {
              error: addResult?.error,
              details: addResult?.details,
            });
          }
        } else {
          Logger.log('info', 'general', 'setupKindeIntegration', 'Skipping Kinde user addition (organization created with fallback)');
        }
      } catch (err: unknown) {
        // Non-fatal: user is already provisioned in Kinde via org creation.
        // Role assignment is best-effort; failure must not abort onboarding.
        const addUserError = err as Error & { response?: { status?: number } };
        Logger.log('warning', 'general', 'setupKindeIntegration', 'addUserToOrganization threw unexpectedly (non-fatal, onboarding continues)', { error: addUserError.message });
      }
    } else {
      // Create new user in Kinde
      try {
        const kindeUser = await kindeService.createUser({
          profile: {
            given_name: firstName || '',
            family_name: lastName || ''
          },
          identities: [{
            type: 'email',
            details: { email: adminEmail }
          }],
          organization_code: actualOrgCode
        });

        finalKindeUserId = kindeUser?.id;
        userName = kindeUser ? `${kindeUser.given_name || ''} ${kindeUser.family_name || ''}`.trim() : adminEmail.split('@')[0];

        Logger.log('info', 'general', 'setupKindeIntegration', 'New Kinde user created', { kindeUserId: finalKindeUserId });
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('warning', 'general', 'setupKindeIntegration', 'Kinde user creation failed, using fallback', { error: error.message });
        finalKindeUserId = `user_${String(adminEmail).replace('@', '_').replace('.', '_')}_${Date.now()}`;
        userName = firstName && lastName ? `${firstName} ${lastName}` : String(adminEmail).split('@')[0];
        Logger.log('info', 'general', 'setupKindeIntegration', 'Using fallback user ID', { kindeUserId: finalKindeUserId });
      }
    }

    const kindeOrgFinal = kindeOrg as { organization?: { external_id?: string } };
    return {
      orgCode: actualOrgCode,
      externalId: (kindeOrgFinal?.organization?.external_id ?? externalId) as string,
      userId: finalKindeUserId as string,
      userName: userName as string,
      kindeOrg,
      kindeUser: existingUser ? null : { id: finalKindeUserId }
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
