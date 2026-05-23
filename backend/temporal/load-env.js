// Loads backend/.env as a side effect at module-evaluation time.
// Imported FIRST from worker.js so the env is populated before
// temporal-shared/client.js evaluates its top-level TEMPORAL_CONFIG.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Failed to load .env file:', result.error.message);
  console.error('   Attempted path:', envPath);
}
