import type { FastifyInstance } from 'fastify';
import { execSync } from 'node:child_process';

// Resolved once at startup — avoids forking a child process on every request.
function resolveGitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const BUILD_VERSION = resolveGitSha();
const BUILD_TIME = new Date().toISOString();

export async function versionRoutes(fastify: FastifyInstance) {
  fastify.get('/version', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return {
      version: BUILD_VERSION,
      buildTime: BUILD_TIME,
      // Set MIN_FRONTEND_VERSION env var to a specific SHA when a deploy
      // contains breaking changes that require every open tab to reload.
      minRequiredVersion: process.env.MIN_FRONTEND_VERSION ?? null,
    };
  });
}

export default versionRoutes;
