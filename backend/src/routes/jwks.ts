/**
 * Public JWKS endpoint.
 *
 * Exposes the wrapper's JWT signing public key(s) so downstream services
 * (CRM, FA, etc.) can verify service tokens asymmetrically. Returns an empty
 * key set when wrapper is still signing with the legacy HS256 shared secret,
 * in which case downstreams must fall back to the shared secret.
 *
 * No authentication is required: this endpoint is public by design.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getJwks } from '../utils/jwt-signing.js';

export default async function jwksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/.well-known/jwks.json', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    reply.header('Content-Type', 'application/json');
    return getJwks();
  });
}
