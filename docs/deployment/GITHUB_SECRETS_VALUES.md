# GitHub Actions secrets – copy these into the repo

**Repo:** https://github.com/Cdineshreddy12/Wrapper  
**Secrets page:** https://github.com/Cdineshreddy12/Wrapper/settings/secrets/actions  

1. Sign in to GitHub, open the link above, then click **“New repository secret”** for each.

---

## Secret 1: `EC2_HOST`

**Name:** `EC2_HOST`  
**Value (copy exactly):**
```
35.171.71.112
```

---

## Secret 2: `EC2_USER`

**Name:** `EC2_USER`  
**Value (copy exactly):**
```
ec2-user
```

---

## Secret 3: `EC2_SSH_KEY`

**Name:** `EC2_SSH_KEY`  
**Value:** Paste the **entire** contents of your deploy private key (the key you use to SSH into the wrapper EC2 instance).

- Include the first line: `-----BEGIN OPENSSH PRIVATE KEY-----` (or `-----BEGIN RSA PRIVATE KEY-----`)
- Include the last line: `-----END OPENSSH PRIVATE KEY-----` (or `-----END RSA PRIVATE KEY-----`)
- No extra spaces at the start or end

If you haven’t created a deploy key yet, see **One-time EC2 setup** in `DEPLOY_EC2.md`. Or use the AWS-created key: open **`wrapper_deploy_key.pem`** in the repo root (gitignored), copy its entire contents into the Secret field, then delete that file. Add the public key to the wrapper EC2 instance once when running—see the command in `DEPLOY_EC2.md`.
