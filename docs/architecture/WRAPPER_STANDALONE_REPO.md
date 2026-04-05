# Maintaining Wrapper in a Separate Repo

This doc describes how to keep a copy of the **wrapper** code in the **Wrapper** GitHub repo (`Cdineshreddy12/Wrapper`) while also keeping it inside **MegaRepo**.

---

## Clone the standalone repo (no MegaRepo)

If you only want the Wrapper code (e.g. on another machine or for a teammate), clone from GitHub:

```bash
git clone https://github.com/Cdineshreddy12/Wrapper.git
cd Wrapper
```

Then install dependencies and add env:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
# Copy backend/.env.example to backend/.env and fill in values (or copy your existing .env)
```

Use this when the Wrapper repo has already been pushed to at least once (see below).

---

## Create or sync from MegaRepo: Run the setup script

From your machine (not in Cursor’s sandbox), run:

```bash
cd /Users/chintadineshreddy/Desktop/MegaRepo
./wrapper/scripts/setup-wrapper-standalone-repo.sh
```

Or from inside `wrapper`:

```bash
cd /Users/chintadineshreddy/Desktop/MegaRepo/wrapper
./scripts/setup-wrapper-standalone-repo.sh
```

The script will:

1. Copy the wrapper folder to `~/Desktop/WrapperStandalone` (excluding `node_modules`, `.git`, `.env`, `dist`, `build`, etc.).
2. Run `git init` there and add `origin` → `https://github.com/Cdineshreddy12/Wrapper.git`.

**Then you do:**

```bash
cd ~/Desktop/WrapperStandalone
npm install    # in backend/ and frontend/ (or run in each)
git fetch origin
git branch -M main   # or 'working' if that's your default
# If remote has existing history you want to keep:
git pull origin main --allow-unrelated-histories
# Then add your copied files and commit:
git add -A
git commit -m "Sync from MegaRepo: loading states, breadcrumbs, billing/onboarding"
git push -u origin main
```

If you prefer to **replace** the Wrapper repo’s history with this copy (use with care):

```bash
git add -A
git commit -m "Sync from MegaRepo: full wrapper codebase"
git push -u origin main --force
```

### Custom paths

```bash
./wrapper/scripts/setup-wrapper-standalone-repo.sh /path/to/MegaRepo/wrapper /path/to/WrapperStandalone
```

## Notes

- **`.env`** is not copied. Copy `backend/.env` into `WrapperStandalone/backend/` manually (or use a `.env.example`).
- **`node_modules`** are not copied. Run `npm install` in `backend/` and `frontend/` inside `WrapperStandalone` after copying.
- After the first push, you can keep the two repos in sync by re-running the script (with a new destination or the same one, then committing and pushing from `WrapperStandalone`).
