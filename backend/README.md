# NewsMind Backend

NestJS backend for the NewsMind Humas DPRD workflow.

## Scope

- Auth + RBAC
- News clipping ingestion
- Approval workflow
- AI orchestration through the FastAPI service
- Audit logging
- PostgreSQL raw SQL repository pattern

## Setup

```bash
bun install
bun run db:migrate
bun run start:dev
```

## Database

Use Laragon PostgreSQL database `newsmind`.

```env
DATABASE_URL=postgresql://postgres@localhost:5432/newsmind
```

## API

- `GET /api/v1`
- `GET /api/v1/health`

## Notes

- No ORM
- All SQL should be parameterized
- AI jobs must stay asynchronous
