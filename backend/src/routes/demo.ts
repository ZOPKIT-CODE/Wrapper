import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../middleware/auth/auth.js';
import { db } from '../db/index.js';
import { contactSubmissions } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import Logger from '../utils/logger.js';

export default async function demoRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  fastify.post('/schedule', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const name = (body.name as string) ?? '';
      const email = (body.email as string) ?? '';
      const company = body.company as string | null | undefined;
      const phone = body.phone as string | null | undefined;
      const jobTitle = body.jobTitle as string | null | undefined;
      const companySize = body.companySize as string | null | undefined;
      const preferredTime = body.preferredTime as string | null | undefined;
      const comments = body.comments as string | null | undefined;

      Logger.log('info', 'routes', 'schedule-demo', '🎯 Demo Request Received:', {
        name,
        email,
        company,
        phone,
        jobTitle,
        companySize,
        preferredTime,
        comments,
        timestamp: new Date().toISOString(),
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      await db.insert(contactSubmissions).values({
        name,
        email,
        company: company ?? null,
        phone: phone ?? null,
        jobTitle: jobTitle ?? null,
        companySize: companySize ?? null,
        preferredTime: preferredTime ?? null,
        comments: comments ?? null,
        source: 'demo',
        ip: request.ip ?? null,
        userAgent: (request.headers['user-agent'] as string) ?? null,
      } as any);

      await new Promise(resolve => setTimeout(resolve, 1500));

      reply.send({
        success: true,
        message: 'Demo scheduled successfully! Our team will contact you within 24 hours.',
        data: {
          scheduled: true,
          estimatedContact: '24 hours'
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'schedule-demo', 'Demo scheduling error', { error: error.message, stack: error.stack });
      reply.code(500).send({
        success: false,
        message: 'Failed to schedule demo. Please try again.'
      });
    }
  });

  fastify.get('/stats', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const totalDemos = await db.select().from(contactSubmissions).where(eq(contactSubmissions.source, 'demo'));

      reply.send({
        success: true,
        data: {
          totalDemos: totalDemos.length,
          pendingDemos: totalDemos.length,
          completedDemos: 0,
          conversionRate: 0
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'demo-stats', 'Demo stats error', { error: error.message, stack: error.stack });
      reply.code(500).send({
        success: false,
        message: 'Failed to fetch demo statistics'
      });
    }
  });
}
