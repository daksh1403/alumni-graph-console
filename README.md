# Alumni Graph Console — backend

Neo4j graph backend for the Alumni Network & Engagement Platform. Runs on
Cloudflare Workers and queries Neo4j through its HTTPS Query API. Uses Cypher;
no JDBC and no D1 runtime binding.

Repository: `daksh1403/alumni-graph-console`, branch `graph-backend`.
This repository contains backend code only. The complete Cloudflare site also
serves a separately maintained local `frontend/` directory, which is ignored by
Git and never included in this repository's history.

## Setup

Requires Node.js 22+, Wrangler, Python 3 for D1 export conversion, and
[Neo4j CLI](https://github.com/neo4j-labs/neo4j-cli) for database imports.

```sh
npm ci
uv tool install neo4j-cli
cp .env.example .dev.vars
```

Edit `.dev.vars` locally. Set `NEO4J_URI` to the Bolt address for CLI commands
(for Aura, `neo4j+s://<instance>.databases.neo4j.io`) and `NEO4J_HTTP_URL` to the
corresponding HTTPS origin (`https://<instance>.databases.neo4j.io`). Set the
actual database name supplied by your instance, username, password, and a long
random `GRAPH_ADMIN_TOKEN`. Never commit credentials.

For a local installation, use `NEO4J_URI=neo4j://localhost:7687` and
`NEO4J_HTTP_URL=http://localhost:7474`. Query API requires Neo4j 5.19 or newer;
use a current release with Query API enabled. `npm run dev` starts the API;
the API-only root returns a JSON service description.

## Create Aura through Neo4j CLI

Sign in at <https://console.neo4j.io/account> and download Aura API credentials.
These are separate from a database username/password. Then run:

```sh
neo4j-cli credential aura-client add --name alumni --env /absolute/path/to/aura-client-creds.txt --rw
neo4j-cli aura workspace list
neo4j-cli aura workspace use ORGANIZATION_ID/PROJECT_ID --rw
neo4j-cli aura instance create --name alumni-graph-console --type free --no-credential-print --rw
```

The CLI stores the generated database credential locally. Wait for the instance
to report `running` before using it. Use the database credentials to configure
`.dev.vars` and Worker secrets. This setup deliberately requests the Free tier;
if unavailable, select a different account/project or resolve the quota rather
than silently provisioning a paid instance.

## Graph and migration

Ten node labels preserve the original entity identities: Alumni, Student,
Department, Batch, Company, Skill, Event, Donation, Job, and Mentorship.
Relationships include IN_DEPARTMENT, IN_BATCH, PART_OF, WORKS_AT, HAS_SKILL,
ATTENDED, PROVIDES, FOR_STUDENT, ORGANIZES, MADE, POSTED, and AT_COMPANY.
Mentorship preserves the source composite identity `(AlumniID, MentorshipID)`;
phone numbers and student emails become list properties. Null foreign keys do
not create fake nodes. All other source fields remain properties.

Export the original D1 database using its existing Wrangler configuration:

```sh
# Run from the original application's webapp/ directory:
wrangler d1 export alumni-db --remote --output /absolute/path/to/alumni-graph-console/private/d1-export.sql
# Then run from this repository:
python3 scripts/export-sqlite.py private/d1-export.sql private/d1-data.json
node scripts/import.js --generate-only
npm run import
npm run verify
```

The export can briefly pause D1 access. Exported data and generated import
statements stay in ignored `private/`. Conversion rejects duplicate identities,
missing source tables, dangling references, invalid ranges, and duplicate natural
keys. Run against an empty target database first. The import creates unique
constraints, then applies all data statements in one atomic transaction through
`neo4j-cli`. `MERGE` makes repeating the same import idempotent; this is a snapshot
import, not a continuous synchronization service. It does not delete stale target
nodes or relationships from earlier, different snapshots.

`npm run verify` compares entity identities, every node property, relationship
endpoints, counts, and donation totals, then executes every preset. Run import
and verification twice to check repeatability. The initial production snapshot
maps 14 source tables to 52 nodes and 80 relationships.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Real connectivity check; HTTP 503 if unconfigured/unavailable |
| `GET /api/stats` | Live counts and donation total |
| `GET /api/schema` | Live labels, relationship types and property names |
| `GET /api/presets` | 15 public Cypher queries with default parameters |
| `POST /api/query` | Execute an allowlisted preset or authenticated custom Cypher |

Public request:

```json
{"preset":"skills","parameters":{"skill":"Python"}}
```

Custom query, with `Authorization: Bearer <GRAPH_ADMIN_TOKEN>`:

```json
{"cypher":"MATCH (a:Alumni) RETURN a LIMIT 10","parameters":{}}
```

Presets use fixed statements with validated, separately bound parameters. Public
requests cannot replace the query text. Custom Cypher can write and administer
the database, so the admin token must remain private. Result rows are capped at
500, upstream payloads at 4 MiB, and requests at 64 KiB. The HTTP client has a
15-second deadline; for custom expensive queries also configure database-side
transaction timeouts. Client cancellation does not guarantee server cancellation.
Query API errors are checked in the JSON body even when HTTP status is 202.

## Deployment

```sh
# Wrangler reads secret values interactively:
npm exec -- wrangler secret put NEO4J_HTTP_URL
npm exec -- wrangler secret put NEO4J_USERNAME
npm exec -- wrangler secret put NEO4J_PASSWORD
npm exec -- wrangler secret put GRAPH_ADMIN_TOKEN
```

Set `NEO4J_DATABASE` in `wrangler.jsonc` to the instance's actual database name.
`npm run deploy:api` publishes the backend alone. To publish the complete site,
place the separate frontend in local `frontend/` and run `npm run deploy:site`.
Its temporary configuration binds the assets as `ASSETS` and runs API routes
through the Worker. The site deployment does not push those files to GitHub.
Deploying API-only afterward removes site assets; choose the intended command.

Cloudflare Worker name: `alumni-graph-console`. The original D1 Worker has a
different name and is not overwritten. An unconfigured deployment serves the
console and preset catalogue but correctly reports that live queries are
unavailable. It never falls back to fabricated results.

## Validation and submission

```sh
npm test
npm audit
npm run deploy:api -- --dry-run
```

Tests cover adapter errors, parameters, graph extraction, authorization, input
limits and graph-model validation. Unit tests simulate the Neo4j HTTP boundary;
they do not replace verification against a real Neo4j instance.

For the assignment, demonstrate mentor discovery, shared skills, employer links,
shared events, and bounded paths between alumni. Graph modeling expresses these
relationships directly. Compare an equivalent SQL join to its Cypher traversal;
do not claim universal performance improvements without measurement.

Official references: [Query API](https://neo4j.com/docs/query-api/current/),
[Cypher](https://neo4j.com/docs/cypher-manual/current/),
[graph modeling](https://neo4j.com/docs/getting-started/data-modeling/),
[Neo4j CLI](https://github.com/neo4j-labs/neo4j-cli).
