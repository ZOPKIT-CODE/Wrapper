/**
 * Per-worker setup for integration tests.
 *
 * Registers globals that the application normally installs during server startup
 * (see app-fastify.ts) but which don't exist in the bare integration harness.
 *
 * `global.logToES` is an Elasticsearch-logging hook that several service code paths
 * (e.g. onboarding-db-service) call directly. Outside a running server it's
 * undefined, so those paths throw `TypeError: global.logToES is not a function`.
 * Install a no-op (the unit tests mock it the same way) so the service logic runs.
 */
type LogToES = (level: string, message: string, data?: Record<string, unknown>) => void;

if (typeof (globalThis as { logToES?: LogToES }).logToES !== 'function') {
  (globalThis as { logToES?: LogToES }).logToES = () => {};
}
