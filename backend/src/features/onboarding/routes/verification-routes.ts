/**
 * 🔐 **VERIFICATION ROUTES**
 * API endpoints for PAN and GSTIN verification
 * Allows users to verify documents before submitting the form
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import VerificationService from '../services/verification-service.js';

export default async function verificationRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  /**
   * Verify PAN number
   * POST /onboarding/verify-pan
   */
  fastify.post('/verify-pan', {
    schema: {
      body: {
        type: 'object',
        required: ['pan'],
        properties: {
          pan: {
            type: 'string',
            pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
            minLength: 10,
            maxLength: 10
          },
          name: { type: 'string', minLength: 2, maxLength: 100 }
        }
      }
    },
    config: { rateLimit: { max: 10, timeWindow: 60000 } }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { pan, name } = body;
      const companyName = (name || body.companyName || body.legalCompanyName) as string | undefined;

      console.log(`🔍 PAN verification request: ${pan}${companyName ? ` for ${companyName}` : ''}`);

      const result = await VerificationService.verifyPAN(pan as string, companyName ?? '');

      if (result.verified) {
        return reply.code(200).send({
          success: true,
          verified: true,
          message: 'PAN verified successfully',
          details: result.details
        });
      } else {
        // Return appropriate status code based on error type
        let statusCode = 400;
        if (result.requiresWhitelist) statusCode = 403;
        if (result.endpointError) statusCode = 404;
        
        return reply.code(statusCode).send({
          success: false,
          verified: false,
          message: result.error || 'PAN verification failed',
          retryable: result.retryable || false,
          requiresWhitelist: result.requiresWhitelist || false,
          endpointError: result.endpointError || false,
          details: result.details
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ PAN verification error:', error);
      return reply.code(500).send({
        success: false,
        verified: false,
        message: error.message || 'An error occurred during PAN verification',
        retryable: true
      });
    }
  });

  /**
   * Verify GSTIN
   * POST /onboarding/verify-gstin
   */
  fastify.post('/verify-gstin', {
    schema: {},
    config: { rateLimit: { max: 10, timeWindow: 60000 } }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { gstin, businessName } = body;
      const companyName = (businessName || body.companyName || body.legalCompanyName) as string | undefined;

      console.log(`🔍 GSTIN verification request: ${gstin}${companyName ? ` for ${companyName}` : ''}`);

      const result = await VerificationService.verifyGSTIN(gstin as string, companyName ?? '');

      if (result.verified) {
        // Check if GSTIN is active
        const details = result.details as { status?: string; isActive?: boolean } | undefined;
        const status = details?.status;
        const isActive = details?.isActive;
        
        if (status && status.toLowerCase() !== 'active' && !isActive) {
          return reply.code(400).send({
            success: false,
            verified: false,
            message: `GSTIN status is ${status}. Only active GSTINs are allowed.`,
            details: result.details,
            retryable: false
          });
        }

        return reply.code(200).send({
          success: true,
          verified: true,
          message: 'GSTIN verified successfully',
          details: result.details
        });
      } else {
        // Return appropriate status code based on error type
        let statusCode = 400;
        if (result.requiresWhitelist) statusCode = 403;
        if (result.endpointError) statusCode = 404;
        
        return reply.code(statusCode).send({
          success: false,
          verified: false,
          message: result.error || 'GSTIN verification failed',
          retryable: result.retryable || false,
          requiresWhitelist: result.requiresWhitelist || false,
          endpointError: result.endpointError || false,
          details: result.details
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ GSTIN verification error:', error);
      return reply.code(500).send({
        success: false,
        verified: false,
        message: error.message || 'An error occurred during GSTIN verification',
        retryable: true
      });
    }
  });
}

