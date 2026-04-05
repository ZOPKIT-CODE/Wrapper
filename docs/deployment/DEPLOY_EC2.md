# Deploy Wrapper to EC2 with PM2 (GitHub Actions)

This doc describes how to deploy the Wrapper app to an EC2 instance using the GitHub Actions workflow. The backend runs with **PM2**; the workflow builds the frontend and deploys both to EC2.

## Wrapper EC2 instance (us-east-1)

The target instance is the **wrapper** EC2 in **us-east-1**:

| Setting     | Value |
|------------|--------|
| **Region** | `us-east-1` |
| **Instance** | Name: `wrapper`, ID: `i-085cb714d4af4a499` |
| **EC2_HOST** | `35.171.71.112` or `ec2-35-171-71-112.compute-1.amazonaws.com` |
| **EC2_USER** | `ec2-user` (Amazon Linux 2023 — omit or set to `ec2-user`) |
| **EC2_SSH_KEY** | Deploy key from AWS key pair `github-actions-wrapper-deploy` (see `GITHUB_SECRETS_VALUES.md`) |

A key pair **`github-actions-wrapper-deploy`** was created in AWS (us-east-1) for GitHub Actions. The private key is in **`wrapper_deploy_key.pem`** in the repo root (gitignored). Copy it into GitHub Secret `EC2_SSH_KEY`, then add the public key to the wrapper instance’s `~/.ssh/authorized_keys` once (see `GITHUB_SECRETS_VALUES.md`). To add the public key once: SSH in and run: `echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDECcJPYnGvoYXdAcjSgBdKm3siqtv2QyExQCJyjVSfwnQaHDgtvxzbG7vRhvT0rjeIk5GOfWeBFRvCI3fLTWXCNYmtEwUQyJq77I2t0Y5YgTgTjdQtiGSHziiE49uvq4t5jLKx9ISbtXxVOfqt5/4Bqcm5Cm+2ModBVX6nVE9QQLL4MFu8F6XuMSvl4oMONfs24LPHq7GFprxDlPrxCalOXnPiF3a6QXxWY/MvHVfdsRwbxh2DKBoHwxJETPLPhgwvlYkJJUuMlUOcGKLlVwfT39E6VvOXxne0uJg+6E7gW7Br5VWvXOqL0fvZklPftIevWkfcdf5VmUxYRl9tQzIh' >> /home/ec2-user/.ssh/authorized_keys`. Start the instance in the AWS console if it is stopped before deploying.

## One-time EC2 setup

1. **Launch an EC2 instance** (Amazon Linux 2 or Ubuntu).
   - Ensure port **22** (SSH) is open in the security group.
   - Optionally open **3000** for the backend API (or put a load balancer/nginx in front).

2. **SSH into the instance** and install Node.js and PM2:

   **Amazon Linux 2023** (wrapper instance in us-east-1):
   ```bash
   sudo dnf update -y
   curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo dnf install -y nodejs
   sudo npm install -g pm2
   ```

   **Amazon Linux 2:**
   ```bash
   sudo yum update -y
   curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   sudo npm install -g pm2
   ```

   **Ubuntu:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

3. **Create app directory** (workflow deploys here):
   ```bash
   mkdir -p /home/ec2-user/Wrapper
   # For Ubuntu, use: mkdir -p /home/ubuntu/Wrapper
   ```

4. **Generate an SSH key** (on your laptop) for GitHub Actions to deploy:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/wrapper_deploy -N ""
   ```

5. **Add the public key** to the EC2 instance:
   ```bash
   ssh-copy-id -i ~/.ssh/wrapper_deploy.pub ec2-user@YOUR_EC2_IP
   # For Ubuntu: ssh-copy-id -i ~/.ssh/wrapper_deploy.pub ubuntu@YOUR_EC2_IP
   ```

6. **Backend env on EC2:** Copy your `backend/.env` (with `DATABASE_URL`, etc.) to the server once, or create it there. The workflow does **not** overwrite `.env` (it’s excluded from rsync).

## GitHub repository secrets

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret        | Description |
|---------------|-------------|
| `EC2_HOST`    | EC2 public IP or hostname (e.g. `3.110.123.45`) |
| `EC2_SSH_KEY` | Full contents of the **private** key (e.g. `~/.ssh/wrapper_deploy`) including `-----BEGIN ... -----` and `-----END ... -----` |
| `EC2_USER`    | (Optional) SSH user: `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu). Defaults to `ec2-user` if not set. |

## What the workflow does

- **Triggers:** Push to `main` or manual run (Actions → Deploy to EC2 → Run workflow).
- **Steps:**
  1. Checkout repo.
  2. Build frontend (`npm ci` + `npm run build` in `frontend/`).
  3. Rsync repo to EC2 at `/home/ec2-user/Wrapper` (excluding `node_modules`, `.env`, `.git`).
  4. On EC2: `cd backend`, `npm ci --omit=dev`, then `pm2 restart wrapper-api` or `pm2 start src/app.js --name wrapper-api` (first run).
  5. **Verify:** Workflow calls `http://EC2_HOST:3000/health`; if port 3000 is open you’ll see “Health check passed”.

## How to trigger and verify deployment

### Trigger the workflow

**Option A – Manual run (recommended for first test)**

1. Open **https://github.com/Cdineshreddy12/Wrapper/actions**.
2. Click **“Deploy to EC2”** in the left sidebar.
3. Click **“Run workflow”** (top right), choose branch **main**, then **“Run workflow”**.
4. The run appears in the list; click it to watch logs.

**Option B – Push to main**

- Push or merge to the `main` branch. The workflow runs automatically.

### Check if deployment succeeded

1. **In GitHub Actions**
   - Go to **Actions → Deploy to EC2** and open the latest run.
   - **Green checkmark** = workflow and all steps (including deploy) completed.
   - **Red X** = something failed; open the run and click the failed job/step to see the error.

2. **Verification step in the workflow**
   - The run has a step **“Verify deployment (health check)”** that calls `http://EC2_HOST:3000/health`.
   - If you see **“Health check passed”** and a short JSON response, the backend is up.
   - If you see **“Health check did not respond”**, the workflow still passes (so the run is green) but port 3000 may be closed in the EC2 security group. Open **Inbound rules** and add **TCP 3000** from `0.0.0.0/0` (or your IP) if you want the health check to succeed.

3. **On the server**
   - SSH: `ssh -i your-key.pem ec2-user@35.171.71.112`
   - Run: `pm2 status` (you should see `wrapper-api` **online**).
   - Run: `pm2 logs wrapper-api` to see backend logs.

4. **From your machine (if port 3000 is open)**
   - `curl http://35.171.71.112:3000/health` — should return `{"status":"ok",...}`.

## After deploy

- **Backend:** Runs as `wrapper-api` under PM2 (default port 3000 unless `PORT` is set in `.env`).
- **Frontend:** Built files are in `frontend/dist/` on EC2. Serve them with nginx or another web server if you want the UI on the same host.
- **Logs:** `ssh ec2-user@EC2_HOST` then `pm2 logs wrapper-api` or `pm2 monit`.

## Troubleshooting

- **Permission denied (publickey):** Check `EC2_SSH_KEY` (full private key, no extra spaces) and that the public key is in `~/.ssh/authorized_keys` on EC2.
- **PM2 not found:** Ensure PM2 is installed globally on EC2 (`npm install -g pm2`) and in the SSH user’s PATH.
- **Backend crashes:** Ensure `backend/.env` exists on EC2 with `DATABASE_URL` and any other required variables.
