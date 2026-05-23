#!/usr/bin/env node

/**
 * Wrapper Temporal Worker
 * Connects to Temporal (local or cloud) and processes wrapper workflows
 *
 * ⚠️  MUST be started via `npm run temporal:worker` (which invokes tsx), NOT
 *     `node temporal/worker.js` directly. The activity files dynamically import
 *     `.ts` source via `.js` paths (e.g. `../src/db/index.js`); plain Node
 *     cannot resolve those, but tsx transparently maps `.js` → `.ts`.
 *     Running with bare `node` fails with `ERR_MODULE_NOT_FOUND`.
 */

// Hard guard: if tsx isn't loaded, fail loud and direct the user to the right command.
if (!process.execArgv.some((arg) => arg.includes('tsx')) && !process.env.NODE_OPTIONS?.includes('tsx')) {
  // tsx sets a sentinel on globalThis when it bootstraps; detect either tsx loader
  // hooks or the obvious env var. Cannot detect 100% — best-effort warning.
  if (!globalThis.__tsxLoaded) {
    console.warn('⚠️  Wrapper Temporal Worker may be running without tsx — activities that');
    console.warn('   import TS source via `.js` paths will fail with ERR_MODULE_NOT_FOUND.');
    console.warn('   Start with:  npm run temporal:worker  (NOT `node temporal/worker.js`)');
  }
}

// Must come first: side-effect import that populates process.env from .env
// before any module that reads it at top level (temporal-shared/client.js).
import './load-env.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TEMPORAL_CONFIG, getTaskQueue } from '../../../temporal-shared/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import * as interAppActivities from './activities/inter-app-activities.js';
import * as organizationActivities from './activities/organization-activities.js';
import * as tenantOnboardingActivities from './activities/tenant-onboarding-activities.js';

async function run() {
  console.log('🚀 Starting Wrapper Temporal Worker...');
  console.log(`🔗 Temporal Address: ${TEMPORAL_CONFIG.address}`);
  console.log(`📋 Namespace: ${TEMPORAL_CONFIG.namespace}`);
  console.log(`📋 Task Queue: ${getTaskQueue('WRAPPER')}`);
  console.log(`✅ Temporal Enabled: ${TEMPORAL_CONFIG.enabled}`);

  if (!TEMPORAL_CONFIG.enabled) {
    console.log('⚠️ Temporal is disabled via TEMPORAL_ENABLED flag. Exiting.');
    process.exit(0);
  }

  try {
    const apiKey  = process.env.TEMPORAL_API_KEY;
    const tlsCert = process.env.TEMPORAL_TLS_CERT;
    const tlsKey  = process.env.TEMPORAL_TLS_KEY;

    const connectOpts = { address: TEMPORAL_CONFIG.address };
    if (apiKey) {
      connectOpts.tls = true;
      connectOpts.apiKey = apiKey;
      connectOpts.metadata = { 'temporal-namespace': TEMPORAL_CONFIG.namespace };
    } else if (tlsCert && tlsKey) {
      connectOpts.tls = {
        clientCertPair: {
          crt: Buffer.from(tlsCert, 'base64'),
          key: Buffer.from(tlsKey, 'base64'),
        },
      };
    }

    const connection = await NativeConnection.connect(connectOpts);

    // Combine all activities
    const activities = {
      ...interAppActivities,
      ...organizationActivities,
      ...tenantOnboardingActivities,
    };

    const workflowsPath = join(__dirname, 'workflows', 'index.js');

    const worker = await Worker.create({
      connection,
      namespace: TEMPORAL_CONFIG.namespace,
      taskQueue: getTaskQueue('WRAPPER'),
      workflowsPath,
      activities,
    });

    console.log('✅ Wrapper Temporal Worker started');
    console.log(`📋 Listening on task queue: ${getTaskQueue('WRAPPER')}`);

    // Handle graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await worker.shutdown();
        console.log('✅ Worker shut down successfully');
      } catch (error) {
        console.error('❌ Error shutting down worker:', error);
      }
      try {
        await connection.close();
        console.log('✅ Connection closed successfully');
      } catch (error) {
        console.error('❌ Error closing connection:', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    await worker.run();
  } catch (error) {
    console.error('❌ Wrapper Worker error:', error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Failed to start Wrapper Worker:', err);
  process.exit(1);
});

