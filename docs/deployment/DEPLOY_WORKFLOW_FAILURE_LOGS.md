# Deploy Workflow Failure Logs (Run #6)

**Workflow:** Deploy to EC2  
**Run:** https://github.com/Cdineshreddy12/Wrapper/actions/runs/21674353188  
**Commit:** 154e138 – feat: add version-check API and New Version Available banner  
**Status:** Failed  
**Duration:** 1m 17s  
**Failed job:** Deploy backend to EC2 (failed at step 3: Build frontend)

---

## Error summary

**Step:** Build frontend (1m 5s)  
**Result:** Process completed with exit code 1

---

## Full error log (captured from GitHub Actions)

```
Build failed in 11.72s

error during build:

[vite-plugin-pwa:build] [plugin vite-plugin-pwa:build] src/App.tsx: There was an error during the build:

Could not resolve "./pages/test/TestWelcomeScreen" from "src/App.tsx"

Additionally, handling the error in the 'buildEnd' hook caused the following error:
Could not resolve "./pages/test/TestWelcomeScreen" from "src/App.tsx"

file: /home/runner/work/Wrapper/Wrapper/frontend/src/App.tsx

at getRollupError (file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/vite/node_modules/rollup/dist/es/shared/parseAst.js:402:41)
at file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/vite/node_modules/rollup/dist/es/shared/node-entry.js:23444:39
at async catchUnfinishedHookActions (file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/vite/node_modules/rollup/dist/es/shared/node-entry.js:22902:16)
at async rollupInternal (file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/rollup/dist/es/shared/node-entry.js:23427:5)
at async build (file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/vite/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:65709:14)
at async CAC.<anonymous> (file:///home/runner/work/Wrapper/Wrapper/frontend/node_modules/vite/dist/node/cli.js:829:5)

Error: Process completed with exit code 1.
```

---

## Root cause

- **App.tsx** imports `./pages/test/TestWelcomeScreen` (and likely `./pages/test/TestLoadingScreen`).
- The files **frontend/src/pages/test/TestWelcomeScreen.tsx** and **frontend/src/pages/test/TestLoadingScreen.tsx** are **untracked** and were never committed.
- On GitHub Actions, the repo only contains committed files, so Vite cannot resolve those imports and the frontend build fails.

---

## Fix options

1. **Commit the test pages** so they exist in the repo:
   - `frontend/src/pages/test/TestWelcomeScreen.tsx`
   - `frontend/src/pages/test/TestLoadingScreen.tsx`
   - `frontend/src/pages/test/README.md`
   Then push and re-run the workflow.

2. **Remove or guard the test routes** in App.tsx so the build does not depend on untracked files:
   - Remove the imports and routes for `/test/welcome` and `/test/loading`, or
   - Use dynamic imports so the app builds even if the test pages are missing.

After applying one of these, re-run the workflow (or push a new commit) to deploy.
