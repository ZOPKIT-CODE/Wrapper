# Documentation Index

Start here, then follow the links into the deeper docs.

## Onboarding & developer workflow
- [ONBOARDING.md](ONBOARDING.md) — the golden path: clone → run → change schema safely → PR → deploy.
- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) — local setup detail: prerequisites, `.env` values (from Secrets Manager), DB (local Postgres or staging RDS via tunnel), Mathesar.
- [NEW_DEVELOPER_GUIDE.md](NEW_DEVELOPER_GUIDE.md) — full lifecycle (codebase → feature → review → ship) with the legacy-safety rules.

## Database & migrations
- [../backend/src/db/migrations/README.md](../backend/src/db/migrations/README.md) — the pg_dump baseline, migration workflow, drift gates.
- [../deploy/ecs/DB_ACCESS.md](../deploy/ecs/DB_ACCESS.md) — reach the (private) RDS: Mathesar UI, SSM tunnel, Postgres MCP.

## Architecture
- [architecture/rls.md](architecture/rls.md) — Row-Level Security tenant isolation.
- [architecture/WRAPPER_STANDALONE_REPO.md](architecture/WRAPPER_STANDALONE_REPO.md) — the standalone-repo sync tool.
- [../deploy/ARCHITECTURE.md](../deploy/ARCHITECTURE.md) — the ECS Fargate infra (VPC → ALB → Fargate → CDN).

## Deploy & infra
- [../deploy/PLAYBOOK.md](../deploy/PLAYBOOK.md) — the ECS Fargate deploy runbook + outage-prevention rules.
- [../deploy/ci/README.md](../deploy/ci/README.md) — CI/CD workflows (deploy + infra-apply).

## Feature references
- [credit-expiry-implementation.md](credit-expiry-implementation.md) · [credit-expiry-testing-guide.md](credit-expiry-testing-guide.md) — credit-expiry behavior + dev testing.
- [integrations/STRIPE_WEBHOOKS_NGROK.md](integrations/STRIPE_WEBHOOKS_NGROK.md) — local Stripe webhook forwarding.

Per-feature backend docs live next to the code in `backend/src/features/<feature>/README.md`.
