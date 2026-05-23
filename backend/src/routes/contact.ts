import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { contactSubmissions } from '../db/schema/index.js';
import Logger from '../utils/logger.js';

export default async function contactRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  // Submit contact form
  fastify.post('/submit', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const {
        name,
        email,
        company,
        phone,
        jobTitle,
        companySize,
        preferredTime,
        comments
      } = body

      Logger.log('info', 'routes', 'submit-contact-form', '📧 Contact Form Submission Received:', {
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
      })

      // Save to database
      await db.insert(contactSubmissions).values({
        name: name as string,
        email: email as string,
        company: (company as string) || null,
        phone: (phone as string) || null,
        jobTitle: (jobTitle as string) || null,
        companySize: (companySize as string) || null,
        preferredTime: (preferredTime as string) || null,
        comments: (comments as string) || null,
        source: 'contact',
        ip: request.ip || null,
        userAgent: (request.headers['user-agent'] as string) || null,
      })

      reply.send({
        success: true,
        message: 'Thank you for contacting us! We will get back to you soon.',
        data: {
          submitted: true
        }
      })

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'routes', 'submit-contact-form', 'Contact form submission error', { error: error.message, stack: error.stack });
      reply.code(500).send({
        success: false,
        message: 'Failed to submit contact form. Please try again.'
      });
    }
  });
}
