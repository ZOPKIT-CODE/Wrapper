/**
 * Vitest globalSetup for the Valkey cache tests: starts a real Valkey container
 * and exposes it via REDIS_URL/REDIS_ENABLED before any worker spawns (the single
 * fork inherits these). Testcontainers is imported here, in the plain-Node
 * globalSetup context, NOT in a vite-transformed test module (which breaks
 * protobufjs/long).
 */
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

let container: StartedTestContainer | undefined;

export async function setup(): Promise<void> {
  container = await new GenericContainer('valkey/valkey:8').withExposedPorts(6379).start();
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
