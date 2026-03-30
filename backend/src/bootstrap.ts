/**
 * Entry point: logs immediately, then loads app.js.
 * If you see ECANCELED after "Loading app", nodemon restarted during load — run once: npm start
 */
import './instrument.js';

process.stdout.write('🚀 Backend starting...\n');
await new Promise((r) => setImmediate(r));
process.stdout.write('📦 Loading app...\n');
await new Promise((r) => setImmediate(r));

const loadPromise = import('./app.js');
const progress = setInterval(() => {
  process.stdout.write('   … still loading\n');
}, 5000);
try {
  const appModule = await loadPromise;
  clearInterval(progress);
  if (appModule.default && typeof appModule.default.then === 'function') {
    await appModule.default;
  }
} catch (err: unknown) {
  clearInterval(progress);
  const error = err as Error & { code?: string };
  if (error.code === 'ECANCELED') {
    console.error('\n⚠️  Watcher restarted during startup (file changed while loading).');
    console.error('   Run "npm start" to start without watch, or try "npm run dev" again.\n');
    process.exitCode = 0;
  } else {
    console.error('\n❌ Failed to start server:', error.message);
    if (error.code) console.error('   code:', error.code);
    if (error.stack) console.error(error.stack);
    process.exitCode = 1;
    throw err;
  }
} finally {
  clearInterval(progress);
}
