# Fork AI

Fork AI is a Next.js chat application with account-based conversation
management, branching message trees, public sharing, account export, and
multi-model AI chat.

## Quick Start

Prerequisites:

- Node.js 18+
- pnpm
- PostgreSQL
- Redis, required for BullMQ workers and recommended for rate limits

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL`, auth secrets/provider credentials, and
`MISTRAL_API_KEY` before using chat features. See
[docs/developer-docs/ENVIRONMENT.md](docs/developer-docs/ENVIRONMENT.md) for the full
variable reference.

Prepare Prisma:

```bash
pnpm prisma:generate
npx prisma db push
```

Run the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run background workers in a second terminal when testing queued jobs:

```bash
pnpm worker
```

## Common Commands

| Command              | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Start the Next.js development server         |
| `pnpm build`         | Generate Prisma client and build production  |
| `pnpm start`         | Start the production server after a build    |
| `pnpm lint`          | Run ESLint                                   |
| `pnpm test`          | Run Vitest once                              |
| `pnpm test:watch`    | Run Vitest in watch mode                     |
| `pnpm test:coverage` | Run tests with coverage                      |
| `pnpm bench`         | Run Vitest benchmarks                        |
| `pnpm worker`        | Start BullMQ workers                         |
| `pnpm prisma:generate` | Generate the Prisma client                 |

## Documentation

Start with [docs/README.md](docs/README.md).

Developer docs:

- [Getting started](docs/developer-docs/GETTING-STARTED.md)
- [Environment variables](docs/developer-docs/ENVIRONMENT.md)
- [Architecture](docs/developer-docs/ARCHITECTURE.md)
- [Data model](docs/developer-docs/DATA-MODEL.md)
- [API routes](docs/developer-docs/API.md)
- [Async jobs](docs/developer-docs/ASYNC-JOBS.md)
- [Testing](docs/developer-docs/TESTING.md)
- [Usage and cost ledger](docs/developer-docs/USAGE-LEDGER.md)
- [Commit lint guide](docs/development/COMMIT-LINT.md)
- [CI/CD operations](docs/operations/CI-CD.md)

Business analysis docs:

- [BA index](docs/business-analysis/README.md)
- [Product overview](docs/business-analysis/PRODUCT-OVERVIEW.md)
- [User stories](docs/business-analysis/USER-STORIES.md)
- [Functional requirements](docs/business-analysis/FUNCTIONAL-REQUIREMENTS.md)
- [Acceptance criteria](docs/business-analysis/ACCEPTANCE-CRITERIA.md)
- [User journeys](docs/business-analysis/USER-JOURNEYS.md)
- [Requirements traceability](docs/business-analysis/REQUIREMENTS-TRACEABILITY.md)
- [Business rules](docs/business-analysis/BUSINESS-RULES.md)
- [Risks and assumptions](docs/business-analysis/RISKS-ASSUMPTIONS.md)

## Project Structure

```text
fork-ai/
├── app/          # Next.js app routes, layouts, pages, and route handlers
├── components/   # React UI and feature components
├── contexts/     # React context providers
├── docs/         # Product, developer, testing, operations, and provider docs
├── emails/       # React Email templates
├── hooks/        # Client-side hooks
├── lib/          # Server/client utilities, services, and integrations
├── prisma/       # Prisma schema and migrations
├── public/       # Static assets
├── tests/        # Vitest unit and integration tests
└── workers/      # BullMQ worker entry points
```

## Core Features

- AI chat streaming through Mistral models
- Conversation, collection, and message tree management
- Branching chat graph visualization
- Public selective sharing with previews and imports
- Feedback capture on assistant messages
- Account export and account deletion flows
- better-auth email/password and Google auth
- Optional Stripe subscription integration
- Redis-backed rate limiting and BullMQ jobs

## Contributing

Use Conventional Commits as described in
[docs/development/COMMIT-LINT.md](docs/development/COMMIT-LINT.md). Before
opening a PR, run the smallest relevant test set plus `pnpm lint` when the
change touches TypeScript or React code.
