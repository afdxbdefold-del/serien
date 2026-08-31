# serien.de application

Next.js application for the serien.de editorial platform, series database,
automated news pipeline and advertising stack.

## Canonical documentation

- [`docs/HANDOFF.md`](./docs/HANDOFF.md) — system overview and entry point
- [`docs/TAKEOVER_STATUS.md`](./docs/TAKEOVER_STATUS.md) — verified status, access needs and release blockers
- [`docs/OPERATIONS_RUNBOOK.md`](./docs/OPERATIONS_RUNBOOK.md) — production operations
- [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) — API routes and authentication
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — Prisma models
- [`docs/PIPELINE_AND_LLM.md`](./docs/PIPELINE_AND_LLM.md) — publishing pipeline
- [`docs/AD_STACK.md`](./docs/AD_STACK.md) — advertising integrations

## Local commands

```bash
npm ci --legacy-peer-deps
npm run db:generate
npm run dev
```

Copy `.env.example` to `.env` and provide local values through the deployment
environment. Never commit credentials. Do not run database migrations against
production until the incomplete migration baseline documented in the handoff
has been replaced and reviewed.
