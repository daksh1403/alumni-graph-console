# Alumni graph implementation plan

Approved architecture: static frontend and Cloudflare Worker, Neo4j Query API,
no JDBC. New repository `alumni-graph-console`, branch `graph-backend`.
Only backend, migration tools, tests, configuration, and documentation are tracked.
The local ignored `frontend/` directory is included only in site deployment.

- [x] Test and implement the Neo4j HTTP adapter: parameter forwarding, 202 error
  handling, credential isolation, graph serialization, deadlines, result limits.
- [x] Test and implement Worker routes: public preset catalogue, schema/stats,
  health, authenticated custom Cypher, request validation and error handling.
- [x] Export the real D1 database using Wrangler. Convert all 14 tables to nodes,
  relationships, and list properties; validate identities and references.
- [x] Generate Cypher constraints/import statements. Use Neo4j CLI to load a
  disposable local database, repeat import, compare counts and donation totals.
- [x] Convert frontend console to Cypher and add graph results and schema views.
  Keep all frontend sources excluded from the Git index and history.
- [x] Run tests, local graph integration, and browser smoke checks. Push backend
  branch to the new repo. Deploy full site with Wrangler under its new name.
- [x] Connect Aura when credentials exist. Until then, deployed health must
  accurately report database not configured; never simulate successful queries.

Use public allowlisted queries. Custom Cypher requires a bearer admin token.
Do not alter the original D1 service. Keep D1 exports and credentials out of Git.
