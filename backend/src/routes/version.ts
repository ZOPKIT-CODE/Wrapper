import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GITHUB_SHA is exported into the PM2 process env by the deploy workflow.
// Falls back to package.json semver when running outside CI (dev, staging).
function resolveVersion(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as { version?: string };
    return pkg.version ?? 'dev';
  } catch {
    return 'dev';
  }
}

const BUILD_VERSION = resolveVersion();
const BUILD_TIME = new Date().toISOString();

export async function versionRoutes(fastify: FastifyInstance) {
  fastify.get('/version', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return {
      version: BUILD_VERSION,
      buildTime: BUILD_TIME,
      minRequiredVersion: process.env.MIN_FRONTEND_VERSION ?? null,
    };
  });
}

export default versionRoutes;
