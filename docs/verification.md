# Verification — 18 October 2026

Deployment: https://alumni-graph-console.dakshx.workers.dev

Backend repository: https://github.com/daksh1403/alumni-graph-console

Branch: `graph-backend`. Frontend assets are deployed by Wrangler from the local,
Git-ignored `frontend/` directory; they are absent from the repository history.

## Database migration

- Exported all 14 tables from the original remote D1 database with Wrangler.
- Loaded the graph through `neo4j-cli` into isolated local Neo4j 2026.09.0,
  then into the user's initially empty Aura database.
- Repeated each import and verified that counts remained 52 nodes and
  80 relationships.
- Compared all entity identities, all node properties, every relationship
  endpoint, multivalued properties, and the donation total of 250000 against
  the source export.
- Executed all 15 preset queries against both real databases.

## Backend and deployment checks

- 18 Node.js tests cover HTTP parameters/errors, Worker-compatible redirect
  handling, graph extraction, authorization, input limits, and import validation.
- `npm audit` reports zero vulnerabilities.
- API-only and full-site Wrangler dry runs passed.
- Live API integration passed through the public Cloudflare URL: health, live
  counts, live schema, all 15 public presets, authenticated create/read/update/
  delete, duplicate identity rejection, and removal of test records.
- Initial migration counts were 52 nodes and 80 relationships.

## Browser checks

Headless Chromium checks cover desktop and mobile layouts, query catalogue,
search, parameter editing, live counts, graph results, node inspection,
table results, donation queries, and JavaScript errors. The unconfigured state
and unauthenticated custom-query errors were also checked before Aura setup.

Screenshots and integration harnesses are saved locally in ignored `private/`.
Credentials remain in local private configuration and Cloudflare secrets.
The original D1 Worker remains a separate deployment.

## Smaller demonstration dataset

At the user's request, the live Aura database was reduced after the full import
verification. The current dataset has **22 nodes and 33 relationships**:

| Label | Records |
| --- | --- |
| Alumni | 2 |
| Student | 2 |
| Department | 2 |
| Batch | 3 |
| Company | 2 |
| Skill | 3 |
| Event | 2 |
| Donation | 2 |
| Job | 2 |
| Mentorship | 2 |

The original live graph was backed up as JSON and an atomic Cypher restore
script in the private local backup directory before deleting records. Retained
node properties were checked against the source snapshot before reduction.
Only omitted identities and their attached relationships were deleted; retained
records were not rewritten.

`npm run verify -- private/reduced-data.json` checks the reduced graph's
properties, identities, relationship endpoints, counts, and donation total of
125000. All 15 public presets return nonempty results on the live deployment.
The default connection-path query now uses the two retained alumni. Desktop
and mobile browser checks passed against the reduced live graph, and all
18 backend tests pass.
