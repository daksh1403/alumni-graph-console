export class GraphError extends Error {
  constructor(message, status = 502, code = 'DATABASE_ERROR') {
    super(message); this.status = status; this.code = code;
  }
}

export function databaseConfigured(env) {
  return Boolean(env.NEO4J_HTTP_URL && env.NEO4J_USERNAME && env.NEO4J_PASSWORD);
}

function graphFrom(rows) {
  const nodes = new Map(), relationships = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value.elementId && Array.isArray(value.labels)) nodes.set(value.elementId, value);
    else if (value.elementId && value.type && value.startNodeElementId) relationships.set(value.elementId, value);
    else Object.values(value).forEach(visit);
  }
  rows.forEach(visit);
  return {nodes: [...nodes.values()], relationships: [...relationships.values()]};
}

export async function queryNeo4j(env, statement, parameters = {}, options = {}) {
  if (!databaseConfigured(env)) throw new GraphError('Neo4j is not configured. Connect a Neo4j instance to enable live queries.', 503, 'NOT_CONFIGURED');
  const base = new URL(env.NEO4J_HTTP_URL);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new GraphError('Use a Neo4j server URL without credentials, path, or query.',503,'CONFIGURATION_ERROR');
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname))) throw new GraphError('Neo4j requires HTTPS except for localhost.',503,'CONFIGURATION_ERROR');
  const endpoint = `${base.origin}/db/${encodeURIComponent(env.NEO4J_DATABASE || 'neo4j')}/query/v2`;
  const started = Date.now();
  let response;
  try {
    response = await (options.fetch || fetch)(endpoint, {
      method:'POST', redirect:'manual', signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json', Accept:'application/json', Authorization:'Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(`${env.NEO4J_USERNAME}:${env.NEO4J_PASSWORD}`)))},
      body:JSON.stringify({statement, parameters, includeCounters:true, ...(options.readOnly ? {accessMode:'Read'} : {})})
    });
  } catch(error) {
    console.warn('Neo4j transport failed:', error.name, error.message);
    throw new GraphError('Neo4j could not be reached within the request deadline.',503,'UNAVAILABLE');
  }
  if (response.status === 401 || response.status === 403) throw new GraphError('Neo4j rejected the server credentials. Check Worker secrets.',503,'DATABASE_AUTH');
  if (response.status >= 300 && response.status < 400) throw new GraphError('Neo4j returned an unsuccessful response.',502,'UPSTREAM_ERROR');
  let payload;
  try {
    const reader=response.body.getReader(), chunks=[]; let size=0;
    for (;;) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>4*1024*1024) {await reader.cancel(); throw new GraphError('Query result is too large. Add a LIMIT or return fewer properties.',422,'RESULT_TOO_LARGE');}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size); let at=0;
    for(const chunk of chunks) {bytes.set(chunk,at); at+=chunk.length;}
    payload=JSON.parse(new TextDecoder().decode(bytes));
  } catch(error) {if(error instanceof GraphError) throw error; throw new GraphError('Neo4j returned an invalid or incomplete response.');}
  if (payload.errors?.length) throw new GraphError(payload.errors.map(e=>e.message).join('; '),response.status>=500?503:400,payload.errors[0].code || 'CYPHER_ERROR');
  if (!response.ok) throw new GraphError('Neo4j returned an unsuccessful response.',502,'UPSTREAM_ERROR');
  if (!payload.data || !Array.isArray(payload.data.fields) || !Array.isArray(payload.data.values)) throw new GraphError('Neo4j response is missing result data.');
  const maxRows=options.maxRows || 500, rows=payload.data.values.slice(0,maxRows);
  return {ok:true, kind:payload.data.fields.length ? 'query':'execute', columns:payload.data.fields, rows, rowCount:rows.length, truncated:payload.data.values.length>maxRows, graph:graphFrom(rows), counters:payload.counters || {}, notifications:payload.notifications || [], elapsedMs:Date.now()-started};
}
